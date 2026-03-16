import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE_URL = "https://test.example.com";

const handlers = [
  // POST /api/mcp/scan
  http.post(`${BASE_URL}/api/mcp/scan`, async () => {
    return HttpResponse.json({
      success: true,
      sdkConnected: false,
    });
  }),

  // GET /api/mcp/status
  http.get(`${BASE_URL}/api/mcp/status`, ({ request }) => {
    const url = new URL(request.url);
    const project = url.searchParams.get("project");
    return HttpResponse.json({
      project: { name: project || "test-project", url: "https://example.com" },
      latestScan: {
        grade: "B",
        summary: "Almost there — one thing to check",
        passedChecks: 7,
        totalChecks: 8,
        scannedAt: "2026-03-16T00:00:00Z",
        source: "mcp",
      },
      monitoring: {
        uptimePercentage: 99.9,
        uptimeStatus: "up",
        sslDaysRemaining: 60,
        sslStatus: "valid",
      },
    });
  }),

  // GET /api/mcp/issues (with optional check_key for fix)
  http.get(`${BASE_URL}/api/mcp/issues`, ({ request }) => {
    const url = new URL(request.url);
    const checkKey = url.searchParams.get("check_key");

    if (checkKey) {
      return HttpResponse.json({
        guide: {
          check_key: checkKey,
          title: "Fix guide for " + checkKey,
          description: "Description for " + checkKey,
          severity: "critical",
          why: "This is a security risk",
          steps: [{ instruction: "Step 1", code: "// fix code" }],
          aiPrompts: [{ text: "Fix this issue" }],
        },
      });
    }

    return HttpResponse.json({
      scanId: "scan_test_123",
      grade: "C",
      issues: [
        {
          check_key: "api_key_hardcoded",
          category: "secrets",
          severity: "critical",
          title: "API key hardcoded",
          description: "Found hardcoded API key in source code",
        },
        {
          check_key: "no_rate_limit",
          category: "auth",
          severity: "warning",
          title: "No rate limiting",
          description: "Auth endpoints lack rate limiting",
        },
      ],
    });
  }),

  // POST /api/mcp/projects (create)
  http.post(`${BASE_URL}/api/mcp/projects`, async ({ request }) => {
    const body = (await request.json()) as { name: string };
    return HttpResponse.json({
      project: { id: "proj_new_123", name: body.name },
    });
  }),

  // GET /api/mcp/projects (list)
  http.get(`${BASE_URL}/api/mcp/projects`, () => {
    return HttpResponse.json({
      projects: [
        {
          id: "proj_1",
          name: "my-app",
          url: "https://my-app.com",
          github_repo: "user/my-app",
          sdk_connected: true,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
  }),

  // POST /api/mcp/upgrade
  http.post(`${BASE_URL}/api/mcp/upgrade`, () => {
    return HttpResponse.json({
      status: "checkout",
      url: "https://checkout.stripe.com/test",
    });
  }),
];

export const server = setupServer(...handlers);
