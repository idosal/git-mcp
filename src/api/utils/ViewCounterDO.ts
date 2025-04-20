/**
 * Durable Object for handling repository view counts
 * This provides atomic operations to avoid race conditions when incrementing view counts
 */

export class ViewCounterDO {
  private state: DurableObjectState;
  private counts: Map<string, number> = new Map();
  private buffer: Map<string, number> = new Map();
  private bufferTimer: number | null = null;
  private initialized = false;
  private BUFFER_TIME_MS = 5000; // 5 seconds
  private isTestEnvironment = false;

  constructor(state: DurableObjectState) {
    this.state = state;
    // Check if we're in a test environment (setAlarm won't be available)
    this.isTestEnvironment = !this.state.storage.setAlarm;
    // Set up periodic alarm to ensure buffer gets flushed even with low activity
    this.setupAlarm();
  }

  /**
   * Initialize the Durable Object by loading stored data
   */
  private async initialize() {
    if (this.initialized) return;

    // Load stored counts from persistent storage
    const stored = await this.state.storage.get<Map<string, number>>("counts");
    if (stored) {
      this.counts = stored;
    }

    this.initialized = true;
  }

  /**
   * Setup alarm for periodic buffer flushing
   */
  private setupAlarm() {
    try {
      if (this.state.storage.setAlarm) {
        this.state.storage.setAlarm(Date.now() + this.BUFFER_TIME_MS);
      } else {
        // In test environment, we won't have the setAlarm method
        console.error("Error setting alarm: setAlarm is not available");
      }
    } catch (error) {
      console.error("Error setting alarm:", error);
    }
  }

  /**
   * Handle DO alarm - used to flush buffer on a timer
   */
  async alarm() {
    await this.flushBuffer();
    // Set another alarm
    this.setupAlarm();
  }

  /**
   * Flush the buffer to persistent storage
   */
  private async flushBuffer() {
    if (this.buffer.size === 0) return;

    try {
      // Ensure we're initialized
      await this.initialize();

      // Apply buffer changes to main counts
      for (const [key, incrementAmount] of this.buffer.entries()) {
        const currentCount = this.counts.get(key) || 0;
        this.counts.set(key, currentCount + incrementAmount);
      }

      // Persist to storage
      await this.state.storage.put("counts", this.counts);
    } catch (error) {
      console.error("Error flushing buffer:", error);
      // We'll leave the buffer intact so we can try again later
      return;
    }

    // Clear buffer only after successful write
    this.buffer.clear();

    // Clear any pending timer
    if (this.bufferTimer !== null) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }
  }

  /**
   * Add an increment to the buffer and schedule a flush
   */
  private bufferIncrement(key: string, amount: number = 1): number {
    // Add to buffer
    const currentBufferAmount = this.buffer.get(key) || 0;
    const newBufferAmount = currentBufferAmount + amount;
    this.buffer.set(key, newBufferAmount);

    // Calculate the current total (including buffered amounts)
    const persistedCount = this.counts.get(key) || 0;
    const currentTotal = persistedCount + newBufferAmount;

    // Schedule buffer flush if not already scheduled
    if (this.bufferTimer === null && !this.isTestEnvironment) {
      this.bufferTimer = setTimeout(
        () => this.flushBuffer(),
        this.BUFFER_TIME_MS,
      ) as unknown as number;
    }

    return currentTotal;
  }

  /**
   * Handle fetch requests to the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    await this.initialize();

    const url = new URL(request.url);
    const pathParts = url.pathname.slice(1).split("/"); // Remove leading slash and split by /

    // Ensure we have at least a repository key
    if (pathParts.length === 0 || !pathParts[0]) {
      return new Response("Missing repository key", { status: 400 });
    }

    const repoKey = pathParts[0];

    // Handle flush request - for admin/debug use
    if (
      pathParts.length > 1 &&
      pathParts[1] === "flush" &&
      request.method === "POST"
    ) {
      await this.flushBuffer();
      return new Response(
        JSON.stringify({
          success: true,
          flushed: true,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Standard increment and get operations
    if (request.method === "POST") {
      // Increment count using buffer
      const newCount = this.bufferIncrement(repoKey);

      // In test environment, ensure buffer is flushed immediately
      if (this.isTestEnvironment) {
        await this.flushBuffer();
      }

      return new Response(JSON.stringify({ count: newCount }), {
        headers: { "Content-Type": "application/json" },
      });
    } else if (request.method === "GET") {
      // Get current count - calculate from persisted + buffered
      const persistedCount = this.counts.get(repoKey) || 0;
      const bufferedIncrement = this.buffer.get(repoKey) || 0;
      const totalCount = persistedCount + bufferedIncrement;

      return new Response(JSON.stringify({ count: totalCount }), {
        headers: { "Content-Type": "application/json" },
      });
    } else {
      return new Response("Method not allowed", { status: 405 });
    }
  }
}
