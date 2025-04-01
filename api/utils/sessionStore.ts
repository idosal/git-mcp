import { createClient } from "redis";

// Initialize Redis client
const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL environment variable is not set");
}

// We need separate clients for subscribe and publish operations
let subscriberClient: ReturnType<typeof createClient> | null = null;
let publisherClient: ReturnType<typeof createClient> | null = null;
let regularClient: ReturnType<typeof createClient> | null = null;

// Track active subscriber sessions to detect stale sessions
const activeSubscriptionSessions = new Set<string>();

// Session TTL in seconds (30 minutes)
const SESSION_TTL = 60 * 30;

// Key prefix for session storage
const SESSION_PREFIX = "mcp:session:";

// Channel prefix for requests and responses
const REQUEST_CHANNEL_PREFIX = "requests:";
const RESPONSE_CHANNEL_PREFIX = "responses:";

// Key prefix for subscriber counts
const SUBSCRIBER_COUNT_PREFIX = "mcp:subscribers:";

// Get the Redis subscriber client
const getSubscriberClient = async () => {
  if (!subscriberClient) {
    console.info('Creating new Redis subscriber client');
    subscriberClient = createClient({ 
      url: redisUrl,
      socket: {
        keepAlive: 30000, // Keep the socket alive with 30s interval
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
      }
    });
    
    subscriberClient.on("error", (err) => {
      console.error("Redis subscriber error:", err);
    });

    subscriberClient.on("connect", () => {
      console.info("Redis subscriber connected");
    });
    
    subscriberClient.on("reconnecting", () => {
      console.info("Redis subscriber reconnecting...");
    });

    subscriberClient.on("end", () => {
      console.info("Redis subscriber connection closed");
      // Reset the client to null so it can be recreated
      subscriberClient = null;
    });
    
    console.debug('Connecting Redis subscriber client...');
    try {
      await subscriberClient.connect();
      console.info('Redis subscriber client connected successfully');
    } catch (error) {
      console.error('Failed to connect Redis subscriber client:', error);
      subscriberClient = null;
      throw error;
    }
  }
  return subscriberClient;
};

// Get the Redis publisher client
const getPublisherClient = async () => {
  if (!publisherClient) {
    console.info('Creating new Redis publisher client');
    publisherClient = createClient({ 
      url: redisUrl,
      socket: {
        keepAlive: 30000,
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
      }
    });
    
    publisherClient.on("error", (err) => {
      console.error("Redis publisher error:", err);
    });

    publisherClient.on("connect", () => {
      console.info("Redis publisher connected");
    });
    
    publisherClient.on("reconnecting", () => {
      console.info("Redis publisher reconnecting...");
    });

    publisherClient.on("end", () => {
      console.info("Redis publisher connection closed");
      // Reset the client to null so it can be recreated
      publisherClient = null;
    });
    
    console.debug('Connecting Redis publisher client...');
    try {
      await publisherClient.connect();
      console.info('Redis publisher client connected successfully');
    } catch (error) {
      console.error('Failed to connect Redis publisher client:', error);
      publisherClient = null;
      throw error;
    }
  }
  return publisherClient;
};

// Get the Redis regular client for key-value operations
const getRegularClient = async () => {
  if (!regularClient) {
    console.info('Creating new Redis regular client');
    regularClient = createClient({ 
      url: redisUrl,
      socket: {
        keepAlive: 30000,
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
      }
    });
    
    regularClient.on("error", (err) => {
      console.error("Redis regular client error:", err);
    });

    regularClient.on("connect", () => {
      console.info("Redis regular client connected");
    });
    
    regularClient.on("reconnecting", () => {
      console.info("Redis regular client reconnecting...");
    });

    regularClient.on("end", () => {
      console.info("Redis regular client connection closed");
      // Reset the client to null so it can be recreated
      regularClient = null;
    });
    
    console.debug('Connecting Redis regular client...');
    try {
      await regularClient.connect();
      console.info('Redis regular client connected successfully');
    } catch (error) {
      console.error('Failed to connect Redis regular client:', error);
      regularClient = null;
      throw error;
    }
  }
  return regularClient;
};

export interface SessionMessage {
  timestamp: number;
  payload: any;
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
  requestId?: string;
}

export interface SerializedRequest {
  requestId: string;
  url: string;
  method: string;
  body: string | any;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Store a new session in Redis
 */
export async function storeSession(
  sessionId: string,
  metadata: any
): Promise<void> {
  console.debug(`Storing session ${sessionId} with metadata:`, metadata);
  try {
    const redis = await getRegularClient();
    const key = `${SESSION_PREFIX}${sessionId}`;
    
    await redis.set(
      key,
      JSON.stringify({
        created: Date.now(),
        lastActive: Date.now(),
        metadata,
      }),
      { EX: SESSION_TTL }
    );
    console.debug(`Successfully stored session ${sessionId} in Redis`);
  } catch (error) {
    console.error(`Error storing session ${sessionId} in Redis:`, error);
    throw error;
  }
}

export async function sessionExists(sessionId: string): Promise<boolean> {
  console.debug(`Checking if session ${sessionId} exists in Redis`);
  try {
    const redis = await getRegularClient();
    const key = `${SESSION_PREFIX}${sessionId}`;
    const session = await redis.get(key);
    const exists = !!session;
    console.debug(`Session ${sessionId} exists in Redis: ${exists}`);
    return exists;
  } catch (error) {
    console.error(`Error checking if session ${sessionId} exists in Redis:`, error);
    throw error;
  }
}

/**
 * Track subscriber count for a session
 */
async function incrementSubscriberCount(sessionId: string): Promise<number> {
  try {
    const redis = await getRegularClient();
    const key = `${SUBSCRIBER_COUNT_PREFIX}${sessionId}`;
    const count = await redis.incr(key);
    await redis.expire(key, SESSION_TTL);
    console.debug(`Incremented subscriber count for ${sessionId} to ${count}`);
    return count;
  } catch (error) {
    console.error(`Failed to increment subscriber count for ${sessionId}:`, error);
    return -1; // Indicate error
  }
}

/**
 * Decrement subscriber count for a session
 */
async function decrementSubscriberCount(sessionId: string): Promise<number> {
  try {
    const redis = await getRegularClient();
    const key = `${SUBSCRIBER_COUNT_PREFIX}${sessionId}`;
    const count = await redis.decr(key);
    
    // If count <= 0, consider the session has no subscribers
    if (count <= 0) {
      await redis.del(key);
      return 0;
    }
    
    return count;
  } catch (error) {
    console.error(`Failed to decrement subscriber count for ${sessionId}:`, error);
    return -1; // Indicate error
  }
}

/**
 * Get the current number of active subscribers for a session
 */
export async function getActiveSubscribers(sessionId: string): Promise<number> {
  try {
    const redis = await getRegularClient();
    const key = `${SUBSCRIBER_COUNT_PREFIX}${sessionId}`;
    const count = await redis.get(key);
    
    if (!count) {
      // Check if we have a local subscription for this session
      if (activeSubscriptionSessions.has(sessionId)) {
        console.debug(`No Redis count but local subscription exists for ${sessionId}, setting count to 1`);
        await redis.set(key, "1", { EX: SESSION_TTL });
        return 1;
      }
      return 0;
    }
    
    return parseInt(count, 10);
  } catch (error) {
    console.error(`Failed to get subscriber count for ${sessionId}:`, error);
    // If Redis fails but we have a local subscription, assume it's active
    if (activeSubscriptionSessions.has(sessionId)) {
      return 1;
    }
    return 0;
  }
}

/**
 * Publish a message to a session's request channel
 */
export async function queueMessage(
  sessionId: string,
  message: any,
  headers?: Record<string, string | string[] | undefined>,
  method?: string,
  url?: string
): Promise<string> {
  try {
    const publisher = await getPublisherClient();
    const requestId = crypto.randomUUID();
    
    // Ensure Redis client is still connected
    if (!publisher.isReady) {
      await publisher.connect();
      console.info('Redis publisher reconnected');
    }
    
    const request: SerializedRequest = {
      requestId,
      url: url || "",
      method: method || "POST",
      body: message,
      headers: headers || {},
    };
    
    console.debug(`Publishing message to ${REQUEST_CHANNEL_PREFIX}${sessionId} with requestId ${requestId}`);
    await publisher.publish(`${REQUEST_CHANNEL_PREFIX}${sessionId}`, JSON.stringify(request));
    console.debug(`Successfully published message to ${REQUEST_CHANNEL_PREFIX}${sessionId}`);
    
    return requestId;
  } catch (error) {
    console.error(`Error publishing message to ${REQUEST_CHANNEL_PREFIX}${sessionId}:`, error);
    throw error;
  }
}

/**
 * Subscribe to messages for a specific session
 */
export async function subscribeToSessionMessages(
  sessionId: string,
  callback: (message: SerializedRequest) => void
): Promise<() => Promise<void>> {
  try {
    const subscriber = await getSubscriberClient();
    const channel = `${REQUEST_CHANNEL_PREFIX}${sessionId}`;
    
    console.debug(`Subscribing to channel ${channel}...`);
    
    // Add to local tracking
    activeSubscriptionSessions.add(sessionId);
    
    // Increment subscriber count in Redis
    await incrementSubscriberCount(sessionId);
    
    // Ensure Redis client is still connected
    if (!subscriber.isReady) {
      await subscriber.connect();
      console.info('Redis subscriber reconnected');
    }
    
    await subscriber.subscribe(channel, (message) => {
      try {
        console.debug(`Received message on ${channel}`, message.substring(0, 100) + (message.length > 100 ? "..." : ""));
        const parsedMessage = JSON.parse(message) as SerializedRequest;
        console.debug(`Successfully parsed message with requestId ${parsedMessage.requestId}`);
        callback(parsedMessage);
      } catch (error) {
        console.error(`Failed to parse Redis message on channel ${channel}:`, error);
      }
    });
    
    console.info(`Successfully subscribed to ${channel}`);
    
    // Return unsubscribe function
    return async () => {
      try {
        console.debug(`Unsubscribing from channel ${channel}...`);
        
        // Ensure Redis client is still connected before unsubscribing
        if (!subscriber?.isReady) {
          console.debug(`Redis subscriber not ready, skipping explicit unsubscribe for ${channel}`);
        } else {
          await subscriber.unsubscribe(channel);
          console.info(`Successfully unsubscribed from ${channel}`);
        }
        
        // Remove from local tracking
        activeSubscriptionSessions.delete(sessionId);
        
        // Decrement subscriber count in Redis
        await decrementSubscriberCount(sessionId);
      } catch (error) {
        console.error(`Error unsubscribing from ${channel}:`, error);
        
        // Still try to clean up counter and local tracking even if unsubscribe fails
        activeSubscriptionSessions.delete(sessionId);
        await decrementSubscriberCount(sessionId);
        
        throw error;
      }
    };
  } catch (error) {
    console.error(`Error subscribing to channel ${REQUEST_CHANNEL_PREFIX}${sessionId}:`, error);
    throw error;
  }
}

/**
 * Subscribe to response for a specific request
 */
export async function subscribeToResponse(
  sessionId: string,
  requestId: string,
  callback: (response: { status: number; body: string }) => void
): Promise<() => Promise<void>> {
  try {
    const subscriber = await getSubscriberClient();
    const responseChannel = `${RESPONSE_CHANNEL_PREFIX}${sessionId}:${requestId}`;
    
    console.debug(`Subscribing to response channel ${responseChannel}...`);
    
    // Ensure Redis client is still connected
    if (!subscriber.isReady) {
      await subscriber.connect();
      console.info('Redis subscriber reconnected');
    }
    
    await subscriber.subscribe(responseChannel, (message) => {
      try {
        console.debug(`Received response on channel ${responseChannel}`);
        const response = JSON.parse(message) as { status: number; body: string };
        console.debug(`Successfully parsed response with status ${response.status}`);
        callback(response);
      } catch (error) {
        console.error(`Failed to parse response for ${sessionId}:${requestId}:`, error);
      }
    });
    
    console.info(`Successfully subscribed to response channel ${responseChannel}`);
    
    // Return unsubscribe function
    return async () => {
      try {
        console.debug(`Unsubscribing from response channel ${responseChannel}...`);
        
        // Ensure Redis client is still connected before unsubscribing
        if (!subscriber?.isReady) {
          console.debug(`Redis subscriber not ready, skipping explicit unsubscribe for ${responseChannel}`);
          return;
        }
        
        await subscriber.unsubscribe(responseChannel);
        console.info(`Successfully unsubscribed from response channel ${responseChannel}`);
      } catch (error) {
        console.error(`Error unsubscribing from response channel ${responseChannel}:`, error);
        throw error;
      }
    };
  } catch (error) {
    console.error(`Error subscribing to response channel for ${sessionId}:${requestId}:`, error);
    throw error;
  }
}

/**
 * Publish a response for a specific request
 */
export async function publishResponse(
  sessionId: string,
  requestId: string,
  status: number,
  body: string
): Promise<void> {
  const responseChannel = `${RESPONSE_CHANNEL_PREFIX}${sessionId}:${requestId}`;
  const startTime = Date.now();
  
  console.info(`[RESPONSE] Publishing to ${responseChannel} with status ${status}`);
  
  try {
    const publisher = await getPublisherClient();
    console.debug(`[RESPONSE] Got publisher client for ${responseChannel}, took ${Date.now() - startTime}ms`);
    
    // Ensure Redis client is still connected
    if (!publisher.isReady) {
      console.warn(`[RESPONSE] Publisher not ready for ${responseChannel}, reconnecting...`);
      await publisher.connect();
      console.info(`[RESPONSE] Redis publisher reconnected for ${responseChannel}`);
    }
    
    const payload = JSON.stringify({ 
      status, 
      body,
      timestamp: Date.now()
    });
    console.debug(`[RESPONSE] Prepared payload for ${responseChannel}, size: ${payload.length} bytes, payload: ${payload}`);
    
    // Use PUBLISH command directly
    const publishResult = await publisher.publish(responseChannel, payload);
    const duration = Date.now() - startTime;
    
    console.info(
      `[RESPONSE] Published response to ${responseChannel}, ` +
      `status: ${status}, receivers: ${publishResult}, ` + 
      `duration: ${duration}ms, body length: ${body.length}`
    );
    
    // If no receivers, log a warning
    if (publishResult === 0) {
      console.warn(`[RESPONSE] No receivers for ${responseChannel}! The request might time out.`);
      
      // Try publishing again after a short delay
      setTimeout(async () => {
        try {
          console.debug(`[RESPONSE] Re-attempting publish to ${responseChannel}...`);
          const retryResult = await publisher.publish(responseChannel, payload);
          console.info(`[RESPONSE] Re-publish attempt to ${responseChannel} reached ${retryResult} receivers`);
        } catch (e) {
          console.error(`[RESPONSE] Failed in retry publish to ${responseChannel}:`, e);
        }
      }, 100);
    }
  } catch (error) {
    console.error(`[RESPONSE] Error publishing response to ${responseChannel} (after ${Date.now() - startTime}ms):`, error);
    
    // Try with a new publisher as a last resort
    try {
      console.warn(`[RESPONSE] Attempting to publish with new client to ${responseChannel}...`);
      publisherClient = null;
      const newPublisher = await getPublisherClient();
      
      const payload = JSON.stringify({ status, body });
      const retryResult = await newPublisher.publish(responseChannel, payload);
      
      console.info(`[RESPONSE] Emergency publish to ${responseChannel} reached ${retryResult} receivers`);
    } catch (retryError) {
      console.error(`[RESPONSE] Emergency publish failed for ${responseChannel}:`, retryError);
      throw error;
    }
  }
}

/**
 * Legacy function to get pending messages - now returns empty array since we use PubSub
 */
export async function getPendingMessages(sessionId: string): Promise<SessionMessage[]> {
  return [];
}
