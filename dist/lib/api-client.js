const API_URL = process.env.GUARDRAIL_API_URL || "https://guardrail-seven.vercel.app";
const API_KEY = process.env.GUARDRAIL_API_KEY;
const PROJECT_KEY = process.env.GUARDRAIL_PROJECT_KEY; // backward compat
const DEFAULT_PROJECT = process.env.GUARDRAIL_PROJECT;
export class ApiClient {
    baseUrl;
    key;
    defaultProject;
    isAccountKey;
    constructor() {
        this.baseUrl = API_URL;
        // API_KEY takes priority over PROJECT_KEY
        this.key = API_KEY || PROJECT_KEY;
        this.defaultProject = DEFAULT_PROJECT;
        this.isAccountKey = !!API_KEY;
    }
    isConfigured() {
        return !!this.key;
    }
    /** Whether using account-level key (gr_ak_) vs project key (gr_sk_) */
    isAccountMode() {
        return this.isAccountKey;
    }
    /** Get default project name from GUARDRAIL_PROJECT env var */
    getDefaultProject() {
        return this.defaultProject;
    }
    getConfigError() {
        return [
            "GUARDRAIL_API_KEY is not set.",
            "",
            "Get started in 60 seconds:",
            "1. Sign up free → https://guardrail-seven.vercel.app/signup",
            "2. Go to Profile Settings → generate your API Key",
            "3. Add it to your Claude Code MCP config:",
            "",
            "{",
            '  "mcpServers": {',
            '    "guardrail": {',
            '      "command": "npx",',
            '      "args": ["-y", "guardrail-mcp@latest"],',
            '      "env": {',
            '        "GUARDRAIL_API_KEY": "gr_ak_your_key_here"',
            "      }",
            "    }",
            "  }",
            "}",
            "",
            "Free plan includes 3 projects and 10 scans per month.",
        ].join("\n");
    }
    async postRaw(path, body) {
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
    async post(path, body) {
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
            throw new Error(data.error ||
                `API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
    }
    async get(path) {
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
            throw new Error(data.error ||
                `API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
    }
}
export const apiClient = new ApiClient();
