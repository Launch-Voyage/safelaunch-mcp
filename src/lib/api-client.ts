const API_URL =
  process.env.SAFELAUNCH_API_URL || "https://safelaunch.dev";
const API_KEY = process.env.SAFELAUNCH_API_KEY;
const PROJECT_KEY = process.env.SAFELAUNCH_PROJECT_KEY; // backward compat
const DEFAULT_PROJECT = process.env.SAFELAUNCH_PROJECT;

export class ApiClient {
  private baseUrl: string;
  private key: string | undefined;
  private defaultProject: string | undefined;
  private isAccountKey: boolean;

  constructor() {
    this.baseUrl = API_URL;
    // API_KEY takes priority over PROJECT_KEY
    this.key = API_KEY || PROJECT_KEY;
    this.defaultProject = DEFAULT_PROJECT;
    this.isAccountKey = !!API_KEY;
  }

  isConfigured(): boolean {
    return !!this.key;
  }

  /** Whether using account-level key (gr_ak_) vs project key (gr_sk_) */
  isAccountMode(): boolean {
    return this.isAccountKey;
  }

  /** Get default project name from SAFELAUNCH_PROJECT env var */
  getDefaultProject(): string | undefined {
    return this.defaultProject;
  }

  getConfigError(): string {
    return [
      "SAFELAUNCH_API_KEY is not set.",
      "",
      "Get started in 60 seconds:",
      "1. Sign up free → https://safelaunch.dev/signup",
      "2. Go to Profile Settings → generate your API Key",
      "3. Add it to your Claude Code MCP config:",
      "",
      "{",
      '  "mcpServers": {',
      '    "safelaunch": {',
      '      "command": "npx",',
      '      "args": ["-y", "@safelaunch/mcp@latest"],',
      '      "env": {',
      '        "SAFELAUNCH_API_KEY": "gr_ak_your_key_here"',
      "      }",
      "    }",
      "  }",
      "}",
      "",
      "Free plan includes 3 projects and 10 scans per month.",
    ].join("\n");
  }

  async postRaw(path: string, body: unknown): Promise<Response> {
    if (!this.key) {
      throw new Error(this.getConfigError());
    }

    return fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.key}`,
      },
      body: JSON.stringify(body),
    });
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    if (!this.key) {
      throw new Error(this.getConfigError());
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.key}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        (data as { error?: string }).error ||
          `API error: ${res.status} ${res.statusText}`
      );
    }

    return res.json() as Promise<T>;
  }

  async get<T = unknown>(path: string): Promise<T> {
    if (!this.key) {
      throw new Error(this.getConfigError());
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.key}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        (data as { error?: string }).error ||
          `API error: ${res.status} ${res.statusText}`
      );
    }

    return res.json() as Promise<T>;
  }
}

export const apiClient = new ApiClient();
