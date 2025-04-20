import { describe, it, expect, vi, beforeEach } from "vitest";
import { ViewCounterDO } from "../api/utils/ViewCounterDO";

describe("ViewCounterDO", () => {
  // Mock for DurableObjectState
  const mockStorage = {
    get: vi.fn(),
    put: vi.fn(),
  };

  const mockState = {
    storage: mockStorage,
  };

  let viewCounter: ViewCounterDO;

  beforeEach(() => {
    vi.resetAllMocks();
    viewCounter = new ViewCounterDO(mockState as unknown as DurableObjectState);
  });

  describe("fetch", () => {
    it("should increment counter on POST request", async () => {
      // Setup mocks
      mockStorage.get.mockResolvedValue(new Map([["test-repo", 5]]));

      // Create a test request
      const request = new Request("https://counter/test-repo", {
        method: "POST",
      });

      // Call the fetch method
      const response = await viewCounter.fetch(request);
      const data = await response.json();

      // Verify results
      expect(mockStorage.get).toHaveBeenCalledWith("counts");
      expect(mockStorage.put).toHaveBeenCalledWith("counts", expect.any(Map));
      expect(response.status).toBe(200);
      expect(data).toEqual({ count: 6 });

      // Verify the value was updated in the map
      const updatedMap = mockStorage.put.mock.calls[0][1];
      expect(updatedMap.get("test-repo")).toBe(6);
    });

    it("should initialize counter to 1 on first POST request", async () => {
      // Setup mocks
      mockStorage.get.mockResolvedValue(null); // No existing counts

      // Create a test request
      const request = new Request("https://counter/new-repo", {
        method: "POST",
      });

      // Call the fetch method
      const response = await viewCounter.fetch(request);
      const data = await response.json();

      // Verify results
      expect(response.status).toBe(200);
      expect(data).toEqual({ count: 1 });

      // Verify a new map was created with the correct value
      const newMap = mockStorage.put.mock.calls[0][1];
      expect(newMap.get("new-repo")).toBe(1);
    });

    it("should get counter value on GET request", async () => {
      // Setup mocks
      mockStorage.get.mockResolvedValue(new Map([["test-repo", 42]]));

      // Create a test request
      const request = new Request("https://counter/test-repo", {
        method: "GET",
      });

      // Call the fetch method
      const response = await viewCounter.fetch(request);
      const data = await response.json();

      // Verify results
      expect(mockStorage.get).toHaveBeenCalledWith("counts");
      expect(response.status).toBe(200);
      expect(data).toEqual({ count: 42 });
    });

    it("should return 0 for non-existent repo on GET request", async () => {
      // Setup mocks
      mockStorage.get.mockResolvedValue(new Map()); // Empty map

      // Create a test request
      const request = new Request("https://counter/non-existent-repo", {
        method: "GET",
      });

      // Call the fetch method
      const response = await viewCounter.fetch(request);
      const data = await response.json();

      // Verify results
      expect(response.status).toBe(200);
      expect(data).toEqual({ count: 0 });
    });

    it("should return 400 for missing repo key", async () => {
      // Create a test request with no path
      const request = new Request("https://counter/", {
        method: "GET",
      });

      // Call the fetch method
      const response = await viewCounter.fetch(request);

      // Verify results
      expect(response.status).toBe(400);
    });

    it("should return 405 for unsupported methods", async () => {
      // Create a test request with DELETE method
      const request = new Request("https://counter/test-repo", {
        method: "DELETE",
      });

      // Call the fetch method
      const response = await viewCounter.fetch(request);

      // Verify results
      expect(response.status).toBe(405);
    });
  });
});
