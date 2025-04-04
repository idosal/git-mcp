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
  getActiveSubscribers,
} from "./utils/sessionStore.js";
import { parseRawBody } from "./utils/bodyParser.js";
import { Socket } from "net";
import { Readable } from "stream";
import { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "http";

// Generate a unique instance ID for this serverless function
const INSTANCE_ID = `instance-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
console.info(`Server initialized with instance ID: ${INSTANCE_ID}`);

// For local instances only - doesn't work across serverless invocations
let activeTransports: { [sessionId: string]: SSEServerTransport } = {};

// Track session health
let sessionHealthChecks: { [sessionId: string]: NodeJS.Timeout } = {};

// Get max duration from vercel.json config
const maxDuration = 800;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.info(
    `[${INSTANCE_ID}:${requestId}] New request: ${req.method} ${req.url}`,
  );

  const protocol = req.headers.host?.includes("localhost") ? "http" : "https";
  const adjustedUrl = new URL(
    req.url || "",
    `${protocol}://${req.headers.host}`,
  );
  // clean search params
  adjustedUrl.searchParams.forEach((value, key) => {
    if (key !== "sessionId") {
      adjustedUrl.searchParams.delete(key);
    }
  });
  // clean hash
  adjustedUrl.hash = "";
  const adjustedUrlString = adjustedUrl.toString();

  console.debug(
    `[${INSTANCE_ID}:${requestId}] Adjusted URL: ${adjustedUrlString}`,
  );

  if (req.method === "GET") {
    const isSSE = req.headers.accept?.includes("text/event-stream");
    console.debug(`[${INSTANCE_ID}:${requestId}] GET request, isSSE: ${isSSE}`);
    if (!isSSE) {
      const redirectUrlString = new URL(
        "/_" + adjustedUrl.pathname,
        adjustedUrl.origin,
      ).toString();

      console.debug(
        `[${INSTANCE_ID}:${requestId}] Redirecting to ${redirectUrlString}`,
      );
      return res.redirect(redirectUrlString);
    }

    try {
      console.info(
        `[${INSTANCE_ID}:${requestId}] Handling GET request for SSE connection`,
      );

      // Add response headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      console.debug(`[${INSTANCE_ID}:${requestId}] SSE headers set`);

      // Instantiate the MCP server.
      const mcp = new McpServer({
        name: `MCP SSE Server for ${adjustedUrlString}`,
        version: "1.0.0",
      });
      console.debug(`[${INSTANCE_ID}:${requestId}] MCP server instantiated`);

      if (!req.headers.host) {
        throw new Error("Missing host header");
      }

      // Register the "fetch_documentation" tool.
      registerTools(mcp, req.headers.host, adjustedUrlString);
      console.debug(`[${INSTANCE_ID}:${requestId}] Tools registered`);

      // Create an SSE transport.
      const endpoint = "/message";
      const transport = new SSEServerTransport(endpoint, res);
      console.debug(`[${INSTANCE_ID}:${requestId}] SSE transport created`);

      try {
        console.debug(
          `[${INSTANCE_ID}:${requestId}] Connecting MCP server to transport`,
        );
        await mcp.connect(transport);
        console.info(
          `[${INSTANCE_ID}:${requestId}] MCP server connected to transport`,
        );
      } catch (error) {
        console.error(
          `[${INSTANCE_ID}:${requestId}] Failed to connect MCP server to transport:`,
          error,
        );
        throw error;
      }

      const sessionId = transport.sessionId;
      console.info(
        `[${INSTANCE_ID}:${requestId}] Session established: ${sessionId}`,
      );

      // Store in local map (for same-instance handling)
      activeTransports[sessionId] = transport;
      console.debug(
        `[${INSTANCE_ID}:${requestId}] Transport stored in map. Active transports: ${Object.keys(activeTransports).length}`,
      );

      // Setup context-based logging for this session
      // This collects logs from async operations and flushes them periodically
      let logs: {
        type: "log" | "info" | "debug" | "error";
        messages: any[];
      }[] = [];

      // This ensures that logs in async contexts (like Redis subscribers)
      // are captured and logged in the proper request context
      function logInContext(
        severity: "log" | "info" | "debug" | "error",
        ...messages: any[]
      ) {
        logs.push({
          type: severity,
          messages: [`[${INSTANCE_ID}:${requestId}:${sessionId}]`, ...messages],
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
          instanceId: INSTANCE_ID,
          requestId,
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
              logInContext(
                "info",
                `Processing message: ${request.requestId} on instance ${INSTANCE_ID}`,
              );
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
                body = typeof b === "string" ? b : JSON.stringify(b);
                return syntheticRes;
              };

              // Process the message with the transport
              logInContext(
                "debug",
                `Processing request ${request.requestId} on instance ${INSTANCE_ID}`,
              );
              try {
                await transport.handlePostMessage(fReq, syntheticRes);
                logInContext(
                  "debug",
                  `Transport processed message successfully: ${request.requestId}`,
                );
              } catch (e) {
                logInContext(
                  "error",
                  `Transport error processing message ${request.requestId}:`,
                  e,
                );
                status = 500;
                body = JSON.stringify({
                  error: e instanceof Error ? e.message : String(e),
                });
              }

              // Publish the response back to Redis
              logInContext(
                "debug",
                `Publishing response for ${request.requestId} with status ${status} from instance ${INSTANCE_ID}`,
              );
              await publishResponse(sessionId, request.requestId, status, body);

              if (status >= 200 && status < 300) {
                logInContext(
                  "info",
                  `Request ${request.requestId} succeeded with status ${status}`,
                );
              } else {
                logInContext(
                  "error",
                  `Request ${request.requestId} failed with status ${status}: ${body}`,
                );
              }
            } catch (error) {
              logInContext("error", `Error processing message:`, error);
              // Publish error response
              try {
                await publishResponse(
                  sessionId,
                  request.requestId,
                  500,
                  JSON.stringify({
                    error:
                      error instanceof Error ? error.message : String(error),
                  }),
                );
                logInContext(
                  "info",
                  `Published error response for ${request.requestId}`,
                );
              } catch (pubError) {
                logInContext(
                  "error",
                  `Failed to publish error response: ${pubError}`,
                );
              }
            }
          },
        );
        logInContext(
          "info",
          `Subscribed successfully to messages on instance ${INSTANCE_ID}. Session ID: ${sessionId}`,
        );

        // Clean up when the connection closes
        req.on("close", async () => {
          logInContext(
            "info",
            `SSE connection closing on instance ${INSTANCE_ID}`,
          );
          clearInterval(logInterval);
          delete activeTransports[sessionId];

          // Clean up health check if it exists
          if (sessionHealthChecks[sessionId]) {
            clearInterval(sessionHealthChecks[sessionId]);
            delete sessionHealthChecks[sessionId];
          }

          if (unsubscribe) {
            try {
              await unsubscribe();
              logInContext("debug", `Unsubscribed from Redis channels`);
            } catch (error) {
              logInContext(
                "error",
                `Error unsubscribing from Redis channels:`,
                error,
              );
            }
          }

          // Flush remaining logs
          for (const log of logs) {
            console[log.type].apply(console, log.messages);
          }

          console.info(
            `[${INSTANCE_ID}:${requestId}] SSE connection closed, sessionId: ${sessionId}`,
          );
        });
      } catch (error) {
        console.error(
          `[${INSTANCE_ID}:${requestId}] Failed to subscribe to messages for session ${sessionId}:`,
          error,
        );
        throw error;
      }

      // Set up a timeout for the maximum duration of the serverless function
      let resolveTimeout: (value: unknown) => void;
      const waitPromise = new Promise((resolve) => {
        resolveTimeout = resolve;

        // End the connection slightly before the serverless function times out
        setTimeout(
          () => {
            logInContext(
              "info",
              `Max duration reached (${maxDuration}s), closing connection`,
            );
            resolve("max duration reached");
          },
          (maxDuration - 5) * 1000,
        );
      });

      req.on("close", () => resolveTimeout?.("client hung up"));

      // Wait for either timeout or client disconnect
      const closeReason = await waitPromise;
      console.info(
        `[${INSTANCE_ID}:${requestId}] Connection closed: ${closeReason}`,
      );

      // Final cleanup
      clearInterval(logInterval);

      // Return a proper response to end the function
      res.status(200).end();
    } catch (error) {
      console.error(
        `[${INSTANCE_ID}:${requestId}] MCP SSE Server error:`,
        error,
      );

      try {
        res.write(
          `data: ${JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          })}\n\n`,
        );
        res.end();
      } catch (writeError) {
        console.error(
          `[${INSTANCE_ID}:${requestId}] Failed to write error response:`,
          writeError,
        );
      }
    }
    return;
  }

  // POST /message?sessionId=...: handle incoming messages.
  if (req.method === "POST" && adjustedUrl.pathname.endsWith("/message")) {
    const sessionId = adjustedUrl.searchParams.get("sessionId");
    const messageTraceId = Math.random().toString(36).substring(2, 10);
    console.info(
      `[${INSTANCE_ID}:${requestId}] POST message for session ${sessionId} (trace: ${messageTraceId})`,
    );

    if (!sessionId) {
      console.error(
        `[${INSTANCE_ID}:${requestId}] Missing sessionId parameter`,
      );
      res.status(400).json({ error: "Missing sessionId parameter" });
      return;
    }

    try {
      // Check if we have the transport in this instance
      if (activeTransports[sessionId]) {
        // We can handle it directly in this instance
        console.info(
          `[${INSTANCE_ID}:${requestId}] Handling POST message for session ${sessionId} directly in this instance (trace: ${messageTraceId})`,
        );
        try {
          await activeTransports[sessionId].handlePostMessage(req, res);
          console.info(
            `[${INSTANCE_ID}:${requestId}] Successfully handled direct message for session ${sessionId} (trace: ${messageTraceId})`,
          );
          return;
        } catch (directError) {
          console.error(
            `[${INSTANCE_ID}:${requestId}] Error handling direct message for ${sessionId} (trace: ${messageTraceId}):`,
            directError,
          );
          // Fall through to Redis handling if direct handling fails
        }
      }

      // Direct handling is explicitly disabled to diagnose Redis-based handling
      // console.debug(
      //   `[${INSTANCE_ID}:${requestId}] Direct handling is disabled, using Redis-based message handling (trace: ${messageTraceId})`,
      // );

      console.debug(
        `[${INSTANCE_ID}:${requestId}] Checking if session ${sessionId} exists in Redis (trace: ${messageTraceId})`,
      );
      const sessionValid = await sessionExists(sessionId);

      if (!sessionValid) {
        console.error(
          `[${INSTANCE_ID}:${requestId}] No active SSE session found for ${sessionId} (trace: ${messageTraceId})`,
        );
        res
          .status(400)
          .json({ error: "No active SSE session for the provided sessionId" });
        return;
      }

      // Check if there are active subscribers for this session
      const activeSubscribers = await getActiveSubscribers(sessionId);
      console.info(
        `[${INSTANCE_ID}:${requestId}] Session ${sessionId} has ${activeSubscribers} active subscribers (trace: ${messageTraceId})`,
      );

      if (activeSubscribers === 0) {
        console.error(
          `[${INSTANCE_ID}:${requestId}] No active subscribers for session ${sessionId} (trace: ${messageTraceId})`,
        );
        res.status(503).json({
          error:
            "The session exists but has no active subscribers. The SSE connection may have been terminated.",
        });
        return;
      }

      console.debug(
        `[${INSTANCE_ID}:${requestId}] Session ${sessionId} exists, parsing message body (trace: ${messageTraceId})`,
      );
      const rawBody = await parseRawBody(req);
      const message = JSON.parse(rawBody.toString("utf8"));
      console.debug(
        `[${INSTANCE_ID}:${requestId}] Parsed message for session ${sessionId} (trace: ${messageTraceId})`,
      );

      // Queue the message via Redis PubSub
      console.debug(
        `[${INSTANCE_ID}:${requestId}] Queueing message for session ${sessionId} from instance ${INSTANCE_ID} (trace: ${messageTraceId})`,
      );
      const messageRequestId = await queueMessage(
        sessionId,
        message,
        req.headers,
        req.method,
        req.url,
      );
      console.info(
        `[${INSTANCE_ID}:${requestId}] Message queued for session ${sessionId}, requestId: ${messageRequestId} (trace: ${messageTraceId})`,
      );

      // We need to ensure we don't have concurrent requests competing for the same response
      // Use a flag to ensure only one response handler updates the response
      let hasResponded = false;

      // Set up a subscription to listen for a response
      let responseTimeout: NodeJS.Timeout;
      let unsubscribeFunction: () => Promise<void>;

      console.debug(
        `[${INSTANCE_ID}:${requestId}] Setting up response subscription for ${sessionId}:${messageRequestId} (trace: ${messageTraceId})`,
      );

      // Helper function to set up response subscription with proper cleanup
      async function setupResponseSubscription(
        sessionId: string,
        requestId: string,
        traceId: string,
        logRequestId: string,
        res: NextApiResponse,
        onResponse: () => void,
      ) {
        // First create and await the unsubscribe function BEFORE using it in callbacks
        const unsubscribe = await subscribeToResponse(
          sessionId,
          requestId,
          async (response) => {
            console.info(
              `[${INSTANCE_ID}:${logRequestId}] Response received for ${sessionId}:${requestId}, status: ${response.status} (trace: ${traceId})`,
            );

            // Ensure we only respond once by using the provided callback
            try {
              // Return the response to the client
              res.status(response.status).send(response.body);
              console.debug(
                `[${INSTANCE_ID}:${logRequestId}] Response sent to client for ${sessionId}:${requestId} (trace: ${traceId})`,
              );
            } catch (error) {
              console.error(
                `[${INSTANCE_ID}:${logRequestId}] Error sending response to client for ${requestId} (trace: ${traceId}):`,
                error,
              );
            }

            onResponse();
          },
        );

        return unsubscribe;
      }

      try {
        // Create the unsubscribe function before using it in callbacks
        const unsubscribe = await setupResponseSubscription(
          sessionId,
          messageRequestId,
          messageTraceId,
          requestId,
          res,
          () => {
            if (responseTimeout) {
              clearTimeout(responseTimeout);
            }
            hasResponded = true;
          },
        );

        responseTimeout = setTimeout(async () => {
          if (hasResponded) {
            console.debug(
              `[${INSTANCE_ID}:${requestId}] Already responded for ${messageRequestId}, not sending timeout response (trace: ${messageTraceId})`,
            );
            return;
          }

          hasResponded = true;
          console.warn(
            `[${INSTANCE_ID}:${requestId}] Request timed out waiting for response: ${sessionId}:${messageRequestId} (trace: ${messageTraceId})`,
          );

          // Return 202 to indicate message was accepted but is still being processed
          res.status(202).json({
            status: "accepted",
            message: "Message accepted but processing in another instance",
            requestId: messageRequestId,
            trace: messageTraceId,
          });

          // Clean up the subscription after responding, but don't wait for it
          unsubscribe().catch((err) => {
            console.error(
              `[${INSTANCE_ID}:${requestId}] Error unsubscribing after timeout for ${messageRequestId} (trace: ${messageTraceId}):`,
              err,
            );
          });
        }, 7000); // 7 seconds for all requests

        // Clean up subscription when request is closed
        req.on("close", async () => {
          console.debug(
            `[${INSTANCE_ID}:${requestId}] Client closed connection for ${sessionId}:${messageRequestId} (trace: ${messageTraceId})`,
          );
          if (responseTimeout) {
            clearTimeout(responseTimeout);
          }
          if (!hasResponded) {
            await unsubscribe().catch((err) => {
              console.error(
                `[${INSTANCE_ID}:${requestId}] Error unsubscribing on close for ${messageRequestId} (trace: ${messageTraceId}):`,
                err,
              );
            });
          }
        });
      } catch (subscriptionError) {
        console.error(
          `[${INSTANCE_ID}:${requestId}] Error setting up response subscription (trace: ${messageTraceId}):`,
          subscriptionError,
        );
        res.status(500).json({
          error:
            subscriptionError instanceof Error
              ? subscriptionError.message
              : String(subscriptionError),
        });
      }
    } catch (error) {
      console.error(
        `[${INSTANCE_ID}:${requestId}] Error handling POST message (trace: ${messageTraceId}):`,
        error,
      );
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  console.error(
    `[${INSTANCE_ID}:${requestId}] Not found: ${req.method} ${req.url}`,
  );
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
  options: FakeIncomingMessageOptions = {},
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
