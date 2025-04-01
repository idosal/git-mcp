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

// Track active subscriptions by channel to prevent duplicates
const activeSubscriptions = new Map<string, boolean>();

// Track last usage of Redis clients for health checks
let lastSubscriberUsage = 0;
let lastPublisherUsage = 0;
let lastRegularUsage = 0;

// Redis client health check interval (in ms)
const CLIENT_HEALTH_CHECK_INTERVAL = 10000; // 10 seconds

// Session TTL in seconds (30 minutes)
const SESSION_TTL = 60 * 60 * 24;

// Key prefix for session storage
const SESSION_PREFIX = "mcp:session:";

// Channel prefix for requests and responses
const REQUEST_CHANNEL_PREFIX = "requests:";
const RESPONSE_CHANNEL_PREFIX = "responses:";

// Key prefix for subscriber counts
const SUBSCRIBER_COUNT_PREFIX = "mcp:subscribers:";

// Key prefix for instance tracking
const INSTANCE_PREFIX = "mcp:instance:";

// Generate a unique instance ID for this serverless function
const INSTANCE_ID = `instance-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
console.info(`Initialized session store with instance ID: ${INSTANCE_ID}`);

// Get the Redis subscriber client
const getSubscriberClient = async () => {
  const now = Date.now();

  // Check if client exists and if it's been too long since last usage
  if (
    subscriberClient &&
    subscriberClient.isReady &&
    now - lastSubscriberUsage < CLIENT_HEALTH_CHECK_INTERVAL
  ) {
    lastSubscriberUsage = now;
    return subscriberClient;
  }

  // Create new client or reconnect existing one
  if (!subscriberClient || !subscriberClient.isReady) {
    console.info(`[${INSTANCE_ID}] Creating new Redis subscriber client`);

    // Clean up old client if it exists
    if (subscriberClient) {
      try {
        await subscriberClient
          .quit()
          .catch((err) =>
            console.error("Error quitting old subscriber client:", err),
          );
      } catch (e) {
        // Ignore errors during cleanup
      }
      subscriberClient = null;
    }

    subscriberClient = createClient({
      url: redisUrl,
      socket: {
        keepAlive: 20000, // Keep the socket alive every 20s
        reconnectStrategy: (retries) => {
          const delay = Math.min(retries * 100, 3000);
          console.info(
            `[${INSTANCE_ID}] Subscriber reconnecting in ${delay}ms, attempt ${retries}`,
          );
          return delay;
        },
      },
    });

    subscriberClient.on("error", (err) => {
      console.error(`[${INSTANCE_ID}] Redis subscriber error:`, err);
    });

    subscriberClient.on("connect", () => {
      console.info(`[${INSTANCE_ID}] Redis subscriber connected`);
    });

    subscriberClient.on("reconnecting", () => {
      console.info(`[${INSTANCE_ID}] Redis subscriber reconnecting...`);
    });

    subscriberClient.on("end", () => {
      console.info(`[${INSTANCE_ID}] Redis subscriber connection closed`);
      subscriberClient = null;
    });

    console.debug(`[${INSTANCE_ID}] Connecting Redis subscriber client...`);
    try {
      await subscriberClient.connect();
      console.info(
        `[${INSTANCE_ID}] Redis subscriber client connected successfully`,
      );
    } catch (error) {
      console.error(
        `[${INSTANCE_ID}] Failed to connect Redis subscriber client:`,
        error,
      );
      subscriberClient = null;
      throw error;
    }
  }

  lastSubscriberUsage = now;
  return subscriberClient;
};

// Get the Redis publisher client
const getPublisherClient = async () => {
  const now = Date.now();

  // Check if client exists and if it's been too long since last usage
  if (
    publisherClient &&
    publisherClient.isReady &&
    now - lastPublisherUsage < CLIENT_HEALTH_CHECK_INTERVAL
  ) {
    lastPublisherUsage = now;
    return publisherClient;
  }

  // Create new client or reconnect existing one
  if (!publisherClient || !publisherClient.isReady) {
    console.info(`[${INSTANCE_ID}] Creating new Redis publisher client`);

    // Clean up old client if it exists
    if (publisherClient) {
      try {
        await publisherClient
          .quit()
          .catch((err) =>
            console.error("Error quitting old publisher client:", err),
          );
      } catch (e) {
        // Ignore errors during cleanup
      }
      publisherClient = null;
    }

    publisherClient = createClient({
      url: redisUrl,
      socket: {
        keepAlive: 20000,
        reconnectStrategy: (retries) => {
          const delay = Math.min(retries * 100, 3000);
          console.info(
            `[${INSTANCE_ID}] Publisher reconnecting in ${delay}ms, attempt ${retries}`,
          );
          return delay;
        },
      },
    });

    publisherClient.on("error", (err) => {
      console.error(`[${INSTANCE_ID}] Redis publisher error:`, err);
    });

    publisherClient.on("connect", () => {
      console.info(`[${INSTANCE_ID}] Redis publisher connected`);
    });

    publisherClient.on("reconnecting", () => {
      console.info(`[${INSTANCE_ID}] Redis publisher reconnecting...`);
    });

    publisherClient.on("end", () => {
      console.info(`[${INSTANCE_ID}] Redis publisher connection closed`);
      publisherClient = null;
    });

    console.debug(`[${INSTANCE_ID}] Connecting Redis publisher client...`);
    try {
      await publisherClient.connect();
      console.info(
        `[${INSTANCE_ID}] Redis publisher client connected successfully`,
      );
    } catch (error) {
      console.error(
        `[${INSTANCE_ID}] Failed to connect Redis publisher client:`,
        error,
      );
      publisherClient = null;
      throw error;
    }
  }

  lastPublisherUsage = now;
  return publisherClient;
};

// Get the Redis regular client for key-value operations
const getRegularClient = async () => {
  const now = Date.now();

  // Check if client exists and if it's been too long since last usage
  if (
    regularClient &&
    regularClient.isReady &&
    now - lastRegularUsage < CLIENT_HEALTH_CHECK_INTERVAL
  ) {
    lastRegularUsage = now;
    return regularClient;
  }

  // Create new client or reconnect existing one
  if (!regularClient || !regularClient.isReady) {
    console.info(`[${INSTANCE_ID}] Creating new Redis regular client`);

    // Clean up old client if it exists
    if (regularClient) {
      try {
        await regularClient
          .quit()
          .catch((err) =>
            console.error("Error quitting old regular client:", err),
          );
      } catch (e) {
        // Ignore errors during cleanup
      }
      regularClient = null;
    }

    regularClient = createClient({
      url: redisUrl,
      socket: {
        keepAlive: 20000,
        reconnectStrategy: (retries) => {
          const delay = Math.min(retries * 100, 3000);
          console.info(
            `[${INSTANCE_ID}] Regular client reconnecting in ${delay}ms, attempt ${retries}`,
          );
          return delay;
        },
      },
    });

    regularClient.on("error", (err) => {
      console.error(`[${INSTANCE_ID}] Redis regular client error:`, err);
    });

    regularClient.on("connect", () => {
      console.info(`[${INSTANCE_ID}] Redis regular client connected`);
    });

    regularClient.on("reconnecting", () => {
      console.info(`[${INSTANCE_ID}] Redis regular client reconnecting...`);
    });

    regularClient.on("end", () => {
      console.info(`[${INSTANCE_ID}] Redis regular client connection closed`);
      regularClient = null;
    });

    console.debug(`[${INSTANCE_ID}] Connecting Redis regular client...`);
    try {
      await regularClient.connect();
      console.info(
        `[${INSTANCE_ID}] Redis regular client connected successfully`,
      );
    } catch (error) {
      console.error(
        `[${INSTANCE_ID}] Failed to connect Redis regular client:`,
        error,
      );
      regularClient = null;
      throw error;
    }
  }

  lastRegularUsage = now;
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
  metadata: any,
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
      { EX: SESSION_TTL },
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
    console.error(
      `Error checking if session ${sessionId} exists in Redis:`,
      error,
    );
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
    console.error(
      `Failed to increment subscriber count for ${sessionId}:`,
      error,
    );
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
    console.error(
      `Failed to decrement subscriber count for ${sessionId}:`,
      error,
    );
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
        console.debug(
          `No Redis count but local subscription exists for ${sessionId}, setting count to 1`,
        );
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
  url?: string,
): Promise<string> {
  try {
    const publisher = await getPublisherClient();
    const requestId = crypto.randomUUID();

    // Ensure Redis client is still connected
    if (!publisher.isReady) {
      await publisher.connect();
      console.info("Redis publisher reconnected");
    }

    const request: SerializedRequest = {
      requestId,
      url: url || "",
      method: method || "POST",
      body: message,
      headers: headers || {},
    };

    console.debug(
      `Publishing message to ${REQUEST_CHANNEL_PREFIX}${sessionId} with requestId ${requestId}`,
    );
    await publisher.publish(
      `${REQUEST_CHANNEL_PREFIX}${sessionId}`,
      JSON.stringify(request),
    );
    console.debug(
      `Successfully published message to ${REQUEST_CHANNEL_PREFIX}${sessionId}`,
    );

    return requestId;
  } catch (error) {
    console.error(
      `Error publishing message to ${REQUEST_CHANNEL_PREFIX}${sessionId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Subscribe to messages for a specific session
 */
export async function subscribeToSessionMessages(
  sessionId: string,
  callback: (message: SerializedRequest) => void,
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
      console.info("Redis subscriber reconnected");
    }

    await subscriber.subscribe(channel, (message) => {
      try {
        console.debug(
          `Received message on ${channel}`,
          message.substring(0, 100) + (message.length > 100 ? "..." : ""),
        );
        const parsedMessage = JSON.parse(message) as SerializedRequest;
        console.debug(
          `Successfully parsed message with requestId ${parsedMessage.requestId}`,
        );
        callback(parsedMessage);
      } catch (error) {
        console.error(
          `Failed to parse Redis message on channel ${channel}:`,
          error,
        );
      }
    });

    console.info(`Successfully subscribed to ${channel}`);

    // Return unsubscribe function
    return async () => {
      try {
        console.debug(`Unsubscribing from channel ${channel}...`);

        // Ensure Redis client is still connected before unsubscribing
        if (!subscriber?.isReady) {
          console.debug(
            `Redis subscriber not ready, skipping explicit unsubscribe for ${channel}`,
          );
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
    console.error(
      `Error subscribing to channel ${REQUEST_CHANNEL_PREFIX}${sessionId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Subscribe to response for a specific request
 */
export async function subscribeToResponse(
  sessionId: string,
  requestId: string,
  callback: (response: { status: number; body: string }) => void,
): Promise<() => Promise<void>> {
  try {
    const subscriber = await getSubscriberClient();
    const responseChannel = `${RESPONSE_CHANNEL_PREFIX}${sessionId}:${requestId}`;

    console.debug(
      `[${INSTANCE_ID}] Subscribing to response channel ${responseChannel}...`,
    );

    // Check if we already have an active subscription to this channel
    if (activeSubscriptions.has(responseChannel)) {
      console.warn(
        `[${INSTANCE_ID}] Already subscribed to ${responseChannel}, skipping duplicate subscription`,
      );
    }

    // Mark this channel as having an active subscription
    activeSubscriptions.set(responseChannel, true);

    // Ensure Redis client is still connected
    if (!subscriber.isReady) {
      await subscriber.connect();
      console.info(
        `[${INSTANCE_ID}] Redis subscriber reconnected for ${responseChannel}`,
      );
    }

    // Define a message handler that validates the requestId
    const messageHandler = (message: string) => {
      try {
        console.debug(
          `[${INSTANCE_ID}] Received response on channel ${responseChannel}`,
        );
        const response = JSON.parse(message) as {
          status: number;
          body: string;
          requestId?: string;
        };

        // Extra validation to ensure we're processing the right message
        if (response.requestId && response.requestId !== requestId) {
          console.warn(
            `[${INSTANCE_ID}] Received response for wrong request ID! Expected ${requestId}, got ${response.requestId}`,
          );
          return;
        }

        console.debug(
          `[${INSTANCE_ID}] Successfully parsed response with status ${response.status}`,
        );
        callback(response);
      } catch (error) {
        console.error(
          `[${INSTANCE_ID}] Failed to parse response for ${sessionId}:${requestId}:`,
          error,
        );
      }
    };

    await subscriber.subscribe(responseChannel, messageHandler);

    console.info(
      `[${INSTANCE_ID}] Successfully subscribed to response channel ${responseChannel}`,
    );

    // Return unsubscribe function
    return async () => {
      try {
        console.debug(
          `[${INSTANCE_ID}] Unsubscribing from response channel ${responseChannel}...`,
        );

        // Ensure Redis client is still connected before unsubscribing
        if (!subscriber?.isReady) {
          console.debug(
            `[${INSTANCE_ID}] Redis subscriber not ready, skipping explicit unsubscribe for ${responseChannel}`,
          );
        } else {
          await subscriber.unsubscribe(responseChannel);
          console.info(
            `[${INSTANCE_ID}] Successfully unsubscribed from response channel ${responseChannel}`,
          );
        }

        // Remove from active subscriptions tracking
        activeSubscriptions.delete(responseChannel);
      } catch (error) {
        console.error(
          `[${INSTANCE_ID}] Error unsubscribing from response channel ${responseChannel}:`,
          error,
        );
        // Still clean up our tracking
        activeSubscriptions.delete(responseChannel);
        throw error;
      }
    };
  } catch (error) {
    console.error(
      `[${INSTANCE_ID}] Error subscribing to response channel for ${sessionId}:${requestId}:`,
      error,
    );
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
  body: string,
): Promise<void> {
  const responseChannel = `${RESPONSE_CHANNEL_PREFIX}${sessionId}:${requestId}`;
  const startTime = Date.now();

  console.info(
    `[${INSTANCE_ID}:RESPONSE] Publishing to ${responseChannel} with status ${status}`,
  );

  try {
    const publisher = await getPublisherClient();
    console.debug(
      `[${INSTANCE_ID}:RESPONSE] Got publisher client for ${responseChannel}, took ${Date.now() - startTime}ms`,
    );

    // Ensure Redis client is still connected
    if (!publisher.isReady) {
      console.warn(
        `[${INSTANCE_ID}:RESPONSE] Publisher not ready for ${responseChannel}, reconnecting...`,
      );
      await publisher.connect();
      console.info(
        `[${INSTANCE_ID}:RESPONSE] Redis publisher reconnected for ${responseChannel}`,
      );
    }

    // Include requestId in the payload for validation
    const payload = JSON.stringify({
      status,
      body,
      requestId, // Include requestId to validate on the receiving end
      timestamp: Date.now(),
    });
    console.debug(
      `[${INSTANCE_ID}:RESPONSE] Prepared payload for ${responseChannel}, size: ${payload.length} bytes`,
    );

    // Use PUBLISH command directly
    const publishResult = await publisher.publish(responseChannel, payload);
    const duration = Date.now() - startTime;

    console.info(
      `[${INSTANCE_ID}:RESPONSE] Published response to ${responseChannel}, ` +
        `status: ${status}, receivers: ${publishResult}, ` +
        `duration: ${duration}ms, body length: ${body.length}`,
    );

    // If no receivers, log a warning
    if (publishResult === 0) {
      console.warn(
        `[${INSTANCE_ID}:RESPONSE] No receivers for ${responseChannel}! The request might time out.`,
      );

      // Try publishing again after a short delay
      setTimeout(async () => {
        try {
          console.debug(
            `[${INSTANCE_ID}:RESPONSE] Re-attempting publish to ${responseChannel}...`,
          );
          const retryResult = await publisher.publish(responseChannel, payload);
          console.info(
            `[${INSTANCE_ID}:RESPONSE] Re-publish attempt to ${responseChannel} reached ${retryResult} receivers`,
          );
        } catch (e) {
          console.error(
            `[${INSTANCE_ID}:RESPONSE] Failed in retry publish to ${responseChannel}:`,
            e,
          );
        }
      }, 100);
    }
  } catch (error) {
    console.error(
      `[${INSTANCE_ID}:RESPONSE] Error publishing response to ${responseChannel} (after ${Date.now() - startTime}ms):`,
      error,
    );

    // Try with a new publisher as a last resort
    try {
      console.warn(
        `[${INSTANCE_ID}:RESPONSE] Attempting to publish with new client to ${responseChannel}...`,
      );
      publisherClient = null;
      const newPublisher = await getPublisherClient();

      // Include requestId in payload
      const payload = JSON.stringify({ status, body, requestId });
      const retryResult = await newPublisher.publish(responseChannel, payload);

      console.info(
        `[${INSTANCE_ID}:RESPONSE] Emergency publish to ${responseChannel} reached ${retryResult} receivers`,
      );
    } catch (retryError) {
      console.error(
        `[${INSTANCE_ID}:RESPONSE] Emergency publish failed for ${responseChannel}:`,
        retryError,
      );
      throw error;
    }
  }
}

/**
 * Legacy function to get pending messages - now returns empty array since we use PubSub
 */
export async function getPendingMessages(
  sessionId: string,
): Promise<SessionMessage[]> {
  return [];
}
