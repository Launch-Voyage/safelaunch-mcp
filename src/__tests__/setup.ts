import { beforeAll, afterEach, afterAll } from "vitest";
import { server } from "./mocks/handlers.js";

// Set env vars before any module imports read them
process.env.SAFELAUNCH_API_KEY = "gr_ak_test_key_12345";
process.env.SAFELAUNCH_API_URL = "https://test.example.com";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
