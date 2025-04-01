import type { NextApiRequest, NextApiResponse } from "next";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerTools } from "./tools/index.js";
import {
  storeSession,
  sessionExists,
  queueMessage,
  subscribeToSessionMessages,
  subscribeToResponse,
  publishResponse,
  SerializedRequest,
  getActiveSubscribers
} from "./utils/sessionStore.js";
import { parseRawBody } from "./utils/bodyParser.js";
import { Socket } from "net";
import { Readable } from "stream";
import { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "http";

// For local instances only - doesn't work across serverless invocations
let activeTransports: { [sessionId: string]: SSEServerTransport } = {};

// Get max duration from vercel.json config
const maxDuration = 59;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.info(`[${requestId}] New request: ${req.method} ${req.url}`);
  
  const adjustedUrl = new URL(req.url || "", `http://${req.headers.host}`);
  console.debug(`[${requestId}] Adjusted URL: ${adjustedUrl.toString()}`);

  if (req.method === "GET") {
    try {
      console.info(`[${requestId}] Handling GET request for SSE connection`);
      
      // Add response headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      console.debug(`[${requestId}] SSE headers set`);
      
      // Instantiate the MCP server.
      const mcp = new McpServer({
        name: `MCP SSE Server for ${req.url}`,
        version: "1.0.0",
      });
      console.debug(`[${requestId}] MCP server instantiated`);

      if (!req.headers.host) {
        throw new Error("Missing host header");
      }

      // Register the "fetch_documentation" tool.
      registerTools(mcp, req.headers.host, req.url);
      console.debug(`[${requestId}] Tools registered`);

      // Create an SSE transport.
      const endpoint = "/message";
      const transport = new SSEServerTransport(endpoint, res);
      console.debug(`[${requestId}] SSE transport created`);

      try {
        console.debug(`[${requestId}] Connecting MCP server to transport`);
        await mcp.connect(transport);
        console.info(`[${requestId}] MCP server connected to transport`);
      } catch (error) {
        console.error(`[${requestId}] Failed to connect MCP server to transport:`, error);
        throw error;
      }

      const sessionId = transport.sessionId;
      console.info(`[${requestId}] Session established: ${sessionId}`);

      // Store in local map (for same-instance handling)
      activeTransports[sessionId] = transport;
      console.debug(`[${requestId}] Transport stored in map. Active transports: ${Object.keys(activeTransports).length}`);

      // Setup context-based logging for this session
      // This collects logs from async operations and flushes them periodically
      let logs: { type: "log" | "info" | "debug" | "error"; messages: any[] }[] = [];
      
      // This ensures that logs in async contexts (like Redis subscribers) 
      // are captured and logged in the proper request context
      function logInContext(severity: "log" | "info" | "debug" | "error", ...messages: any[]) {
        logs.push({
          type: severity,
          messages: [`[${requestId}:${sessionId}]`, ...messages]
        });
      }
      
      // Periodically flush logs to the console
      const logInterval = setInterval(() => {
        if (logs.length > 0) {
          for (const log of logs) {
            console[log.type].apply(console, log.messages);
          }
          logs = [];
        }
      }, 100);

      try {
        // Store in Redis (for cross-instance handling)
        logInContext("debug", `Storing session in Redis`);
        await storeSession(sessionId, {
          host: req.headers.host,
          userAgent: req.headers["user-agent"],
          createdAt: new Date().toISOString(),
          requestId
        });
        logInContext("debug", `Session stored in Redis`);
      } catch (error) {
        logInContext("error", `Failed to store session in Redis:`, error);
        // Continue despite Redis storage failure
      }
      
      // Subscribe to session messages using Redis PubSub
      try {
        logInContext("debug", `Subscribing to messages for session`);
        const unsubscribe = await subscribeToSessionMessages(
          sessionId,
          async (request: SerializedRequest) => {
            try {
              logInContext("info", `Processing message: ${request.requestId}`);
              // Create a fake IncomingMessage object with the stored data
              const fReq = createFakeIncomingMessage({
                method: request.method || "POST",
                url: request.url || req.url,
                headers: request.headers || {},
                body: request.body,
              });
              
              const syntheticRes = new ServerResponse(fReq);
              let status = 200;
              let body = "";
              
              // Capture the response status and body
              syntheticRes.writeHead = (statusCode: number) => {
                status = statusCode;
                return syntheticRes;
              };
              
              syntheticRes.end = (b: unknown) => {
                body = typeof b === 'string' ? b : JSON.stringify(b);
                return syntheticRes;
              };
              
              // Process the message with the transport
              logInContext("debug", `Processing request with transport: ${request.requestId}`);
              try {
                await transport.handlePostMessage(fReq, syntheticRes);
                logInContext("debug", `Transport processed message successfully: ${request.requestId}`);
              } catch (e) {
                logInContext("error", `Transport error processing message ${request.requestId}:`, e);
                status = 500;
                body = JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
              }
              
              // Publish the response back to Redis
              logInContext("debug", `Publishing response for ${request.requestId} with status ${status}`);
              await publishResponse(sessionId, request.requestId, status, body);
              
              if (status >= 200 && status < 300) {
                logInContext("info", `Request ${request.requestId} succeeded with status ${status}`);
              } else {
                logInContext("error", `Request ${request.requestId} failed with status ${status}: ${body}`);
              }
            } catch (error) {
              logInContext("error", `Error processing message:`, error);
              // Publish error response
              try {
                await publishResponse(
                  sessionId, 
                  request.requestId, 
                  500, 
                  JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
                );
                logInContext("info", `Published error response for ${request.requestId}`);
              } catch (pubError) {
                logInContext("error", `Failed to publish error response: ${pubError}`);
              }
            }
          }
        );
        logInContext("info", `Subscribed successfully to messages. Session ID: ${sessionId}`);
        
        // Clean up when the connection closes
        req.on("close", async () => {
          logInContext("info", `SSE connection closing`);
          clearInterval(logInterval);
          delete activeTransports[sessionId];
          
          if (unsubscribe) {
            try {
              await unsubscribe();
              logInContext("debug", `Unsubscribed from Redis channels`);
            } catch (error) {
              logInContext("error", `Error unsubscribing from Redis channels:`, error);
            }
          }
          
          // Flush remaining logs
          for (const log of logs) {
            console[log.type].apply(console, log.messages);
          }
          
          console.info(`[${requestId}] SSE connection closed, sessionId: ${sessionId}`);
        });
      } catch (error) {
        console.error(`[${requestId}] Failed to subscribe to messages for session ${sessionId}:`, error);
        throw error;
      }
      
      // Set up a timeout for the maximum duration of the serverless function
      let resolveTimeout: (value: unknown) => void;
      const waitPromise = new Promise((resolve) => {
        resolveTimeout = resolve;
        
        // End the connection slightly before the serverless function times out
        setTimeout(() => {
          logInContext("info", `Max duration reached (${maxDuration}s), closing connection`);
          resolve("max duration reached");
        }, (maxDuration - 5) * 1000);
      });
      
      req.on("close", () => resolveTimeout?.("client hung up"));
      
      // Wait for either timeout or client disconnect
      const closeReason = await waitPromise;
      console.info(`[${requestId}] Connection closed: ${closeReason}`);
      
      // Final cleanup
      clearInterval(logInterval);
      
      // Return a proper response to end the function
      res.status(200).end();
    } catch (error) {
      console.error(`[${requestId}] MCP SSE Server error:`, error);
      
      try {
        res.write(
          `data: ${JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          })}\n\n`
        );
        res.end();
      } catch (writeError) {
        console.error(`[${requestId}] Failed to write error response:`, writeError);
      }
    }
    return;
  }

  // POST /message?sessionId=...: handle incoming messages.
  if (req.method === "POST" && adjustedUrl.pathname.endsWith("/message")) {
    const sessionId = adjustedUrl.searchParams.get("sessionId");
    console.info(`[${requestId}] POST message for session ${sessionId}`);

    if (!sessionId) {
      console.error(`[${requestId}] Missing sessionId parameter`);
      res.status(400).json({ error: "Missing sessionId parameter" });
      return;
    }

    try {
      // Check if we have the transport in this instance
      if (activeTransports[sessionId]) {
        // We can handle it directly in this instance
        console.info(`[${requestId}] Handling POST message for session ${sessionId} directly`);
        await activeTransports[sessionId].handlePostMessage(req, res);
        return;
      }

      console.debug(`[${requestId}] Checking if session ${sessionId} exists in Redis`);
      const sessionValid = await sessionExists(sessionId);

      if (!sessionValid) {
        console.error(`[${requestId}] No active SSE session found for ${sessionId}`);
        res
          .status(400)
          .json({ error: "No active SSE session for the provided sessionId" });
        return;
      }

      // Check if there are active subscribers for this session
      const activeSubscribers = await getActiveSubscribers(sessionId);
      console.info(`[${requestId}] Session ${sessionId} has ${activeSubscribers} active subscribers`);
      
      if (activeSubscribers === 0) {
        console.error(`[${requestId}] No active subscribers for session ${sessionId}`);
        res.status(503).json({ 
          error: "The session exists but has no active subscribers. The SSE connection may have been terminated." 
        });
        return;
      }

      console.debug(`[${requestId}] Session ${sessionId} exists, parsing message body`);
      const rawBody = await parseRawBody(req);
      const message = JSON.parse(rawBody.toString("utf8"));
      console.debug(`[${requestId}] Parsed message for session ${sessionId}`);

      // Queue the message via Redis PubSub
      console.debug(`[${requestId}] Queueing message for session ${sessionId}`);
      const messageRequestId = await queueMessage(sessionId, message, req.headers, req.method, req.url);
      console.info(`[${requestId}] Message queued for session ${sessionId}, requestId: ${messageRequestId}`);
      
      // Set up a subscription to listen for a response
      let responseTimeout: NodeJS.Timeout;
      
      console.debug(`[${requestId}] Setting up response subscription for ${sessionId}:${messageRequestId}`);
      const unsubscribe = await subscribeToResponse(
        sessionId,
        messageRequestId, 
        (response) => {
          console.info(`[${requestId}] Response received for ${sessionId}:${messageRequestId}, status: ${response.status}`);
          
          if (responseTimeout) {
            clearTimeout(responseTimeout);
          }
          
          // Return the response to the client
          try {
            res.status(response.status).send(response.body);
            console.debug(`[${requestId}] Response sent to client for ${sessionId}:${messageRequestId}`);
          } catch (error) {
            console.error(`[${requestId}] Error sending response to client:`, error);
          }
          
          // Clean up the subscription
          unsubscribe().catch(err => {
            console.error(`[${requestId}] Error unsubscribing from response channel:`, err);
          });
        }
      );
      
      // Set a timeout for the response
      responseTimeout = setTimeout(async () => {
        console.error(`[${requestId}] Request timed out waiting for response: ${sessionId}:${messageRequestId}`);
        await unsubscribe();
        res.status(408).json({ error: "Request timed out waiting for response. The SSE handler may have been terminated." });
      }, 10000); // 10 seconds timeout
      
      // Clean up subscription when request is closed
      req.on("close", async () => {
        console.debug(`[${requestId}] Client closed connection for ${sessionId}:${messageRequestId}`);
        if (responseTimeout) {
          clearTimeout(responseTimeout);
        }
        await unsubscribe();
      });
    } catch (error) {
      console.error(`[${requestId}] Error handling POST message:`, error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  console.error(`[${requestId}] Not found: ${req.method} ${req.url}`);
  res.status(404).end("Not found");
}

// Define the options interface
interface FakeIncomingMessageOptions {
  method?: string;
  url?: string;
  headers?: IncomingHttpHeaders;
  body?: string | Buffer | Record<string, any> | null;
  socket?: Socket;
}

// Create a fake IncomingMessage
function createFakeIncomingMessage(
  options: FakeIncomingMessageOptions = {}
): IncomingMessage {
  const {
    method = "GET",
    url = "/",
    headers = {},
    body = null,
    socket = new Socket(),
  } = options;

  // Create a readable stream that will be used as the base for IncomingMessage
  const readable = new Readable();
  readable._read = (): void => {}; // Required implementation

  // Add the body content if provided
  if (body) {
    if (typeof body === "string") {
      readable.push(body);
    } else if (Buffer.isBuffer(body)) {
      readable.push(body);
    } else {
      readable.push(JSON.stringify(body));
    }
    readable.push(null); // Signal the end of the stream
  }

  // Create the IncomingMessage instance
  const req = new IncomingMessage(socket);

  // Set the properties
  req.method = method;
  req.url = url;
  req.headers = headers;

  // Copy over the stream methods
  req.push = readable.push.bind(readable);
  req.read = readable.read.bind(readable);
  (req as any).on = readable.on.bind(readable);
  req.pipe = readable.pipe.bind(readable);

  return req;
}
