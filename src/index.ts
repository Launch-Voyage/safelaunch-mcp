#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerScanTool } from "./tools/scan.js";
import { registerStatusTool } from "./tools/status.js";
import { registerIssuesTool } from "./tools/issues.js";
import { registerFixTool } from "./tools/fix.js";
import { registerUpgradeTool } from "./tools/upgrade.js";
import { registerCreateProjectTool } from "./tools/create-project.js";
import { registerProjectsTool } from "./tools/projects.js";

const server = new McpServer({
  name: "safelaunch-mcp",
  version: "0.1.0",
});

registerScanTool(server);
registerStatusTool(server);
registerIssuesTool(server);
registerFixTool(server);
registerUpgradeTool(server);
registerCreateProjectTool(server);
registerProjectsTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
