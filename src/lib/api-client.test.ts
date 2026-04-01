import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../__tests__/mocks/handlers.js";

// The ApiClient reads process.env at module-level, so we use dynamic imports
// with vi.resetModules() to test different env configurations.

describe("ApiClient", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("isConfigured", () => {
    it("returns true when SAFELAUNCH_API_KEY is set", async () => {
      process.env.SAFELAUNCH_API_KEY = "gr_ak_test_key_12345";
      const { ApiClient } = await import("./api-client.js");
      const client = new ApiClient();
      expect(client.isConfigured()).toBe(true);
    });

    it("returns true when only SAFELAUNCH_PROJECT_KEY is set", async () => {
      delete process.env.SAFELAUNCH_API_KEY;
      process.env.SAFELAUNCH_PROJECT_KEY = "gr_sk_test_key_12345";
      const { ApiClient } = await import("./api-client.js");
      const client = new ApiClient();
      expect(client.isConfigured()).toBe(true);
      // Restore for other tests
      process.env.SAFELAUNCH_API_KEY = "gr_ak_test_key_12345";
      delete process.env.SAFELAUNCH_PROJECT_KEY;
    });

    it("returns false when no key is set", async () => {
      const origApiKey = process.env.SAFELAUNCH_API_KEY;
      const origProjectKey = process.env.SAFELAUNCH_PROJECT_KEY;
      delete process.env.SAFELAUNCH_API_KEY;
      delete process.env.SAFELAUNCH_PROJECT_KEY;
      const { ApiClient } = await import("./api-client.js");
      const client = new ApiClient();
      expect(client.isConfigured()).toBe(false);
      // Restore
      process.env.SAFELAUNCH_API_KEY = origApiKey;
      process.env.SAFELAUNCH_PROJECT_KEY = origProjectKey;
    });
  });

  describe("isAccountMode", () => {
    it("returns true when SAFELAUNCH_API_KEY is set", async () => {
      process.env.SAFELAUNCH_API_KEY = "gr_ak_test_key_12345";
      const { ApiClient } = await import("./api-client.js");
      const client = new ApiClient();
      expect(client.isAccountMode()).toBe(true);
    });

    it("returns false when only PROJECT_KEY is set", async () => {
      delete process.env.SAFELAUNCH_API_KEY;
      process.env.SAFELAUNCH_PROJECT_KEY = "gr_sk_test_key_12345";
      const { ApiClient } = await import("./api-client.js");
      const client = new ApiClient();
      expect(client.isAccountMode()).toBe(false);
      // Restore
      process.env.SAFELAUNCH_API_KEY = "gr_ak_test_key_12345";
      delete process.env.SAFELAUNCH_PROJECT_KEY;
    });
  });

  describe("get()", () => {
    it("sends correct Authorization header", async () => {
      let capturedAuth: string | null = null;
      server.use(
        http.get("https://test.example.com/api/mcp/test", ({ request }) => {
          capturedAuth = request.headers.get("Authorization");
          return HttpResponse.json({ ok: true });
        })
      );

      const { ApiClient } = await import("./api-client.js");
      const client = new ApiClient();
      await client.get("/api/mcp/test");
      expect(capturedAuth).toBe("Bearer gr_ak_test_key_12345");
    });

    it("throws on non-200 response with error message", async () => {
      server.use(
        http.get("https://test.example.com/api/mcp/fail", () => {
          return HttpResponse.json(
            { error: "Not found" },
            { status: 404 }
          );
        })
      );

      const { ApiClient } = await import("./api-client.js");
      const client = new ApiClient();
      await expect(client.get("/api/mcp/fail")).rejects.toThrow("Not found");
    });

    it("throws generic error when response has no error field", async () => {
      server.use(
        http.get("https://test.example.com/api/mcp/fail2", () => {
          return HttpResponse.json({}, { status: 500 });
        })
      );

      const { ApiClient } = await import("./api-client.js");
      const client = new ApiClient();
      await expect(client.get("/api/mcp/fail2")).rejects.toThrow(
        "API error: 500"
      );
    });

    it("throws when no key is configured", async () => {
      const origKey = process.env.SAFELAUNCH_API_KEY;
      delete process.env.SAFELAUNCH_API_KEY;
      delete process.env.SAFELAUNCH_PROJECT_KEY;
      const { ApiClient } = await import("./api-client.js");
      const client = new ApiClient();
      await expect(client.get("/api/mcp/test")).rejects.toThrow(
        "SAFELAUNCH_API_KEY is not set"
      );
      process.env.SAFELAUNCH_API_KEY = origKey;
    });
  });

  describe("post()", () => {
    it("sends JSON body with correct headers", async () => {
      let capturedBody: unknown = null;
      let capturedContentType: string | null = null;
      server.use(
        http.post("https://test.example.com/api/mcp/test", async ({ request }) => {
          capturedContentType = request.headers.get("Content-Type");
          capturedBody = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      const { ApiClient } = await import("./api-client.js");
      const client = new ApiClient();
      const result = await client.post("/api/mcp/test", { data: "hello" });
      expect(capturedContentType).toBe("application/json");
      expect(capturedBody).toEqual({ data: "hello" });
      expect(result).toEqual({ success: true });
    });

    it("throws on non-200 response", async () => {
      server.use(
        http.post("https://test.example.com/api/mcp/error", () => {
          return HttpResponse.json(
            { error: "Forbidden" },
            { status: 403 }
          );
        })
      );

      const { ApiClient } = await import("./api-client.js");
      const client = new ApiClient();
      await expect(
        client.post("/api/mcp/error", {})
      ).rejects.toThrow("Forbidden");
    });
  });

  describe("getDefaultProject", () => {
    it("returns SAFELAUNCH_PROJECT env var", async () => {
      process.env.SAFELAUNCH_PROJECT = "my-project";
      const { ApiClient } = await import("./api-client.js");
      const client = new ApiClient();
      expect(client.getDefaultProject()).toBe("my-project");
      delete process.env.SAFELAUNCH_PROJECT;
    });

    it("returns undefined when not set", async () => {
      delete process.env.SAFELAUNCH_PROJECT;
      const { ApiClient } = await import("./api-client.js");
      const client = new ApiClient();
      expect(client.getDefaultProject()).toBeUndefined();
    });
  });
});
