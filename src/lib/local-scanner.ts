import { readdir, readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";

export interface RepoFile {
  path: string;
  content: string;
}

const INCLUDE_EXTENSIONS = new Set([
  ".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs",
  ".json", ".toml", ".yaml", ".yml",
]);

const INCLUDE_EXACT = new Set([
  ".gitignore", ".env", ".env.local", ".env.production", ".env.development",
  ".env.example", "package.json", "next.config.js", "next.config.ts",
  "next.config.mjs", "vercel.json", "netlify.toml", "railway.json",
  "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
]);

const EXCLUDE_DIRS = new Set([
  "node_modules", ".next", "dist", "build", "vendor", ".git",
  "__pycache__", ".cache", "coverage", ".turbo", ".vercel",
]);

const MAX_FILES = 50;

function shouldIncludeFile(filePath: string): boolean {
  const parts = filePath.split("/");

  // Check exclusions
  for (const part of parts) {
    if (EXCLUDE_DIRS.has(part)) return false;
  }

  const fileName = parts[parts.length - 1];

  // Exact match
  if (INCLUDE_EXACT.has(fileName)) return true;

  // .env files
  if (fileName.startsWith(".env")) return true;

  // Extension match
  const ext = extname(fileName);
  if (ext && INCLUDE_EXTENSIONS.has(ext)) return true;

  return false;
}

function priorityScore(filePath: string): number {
  if (
    filePath === ".gitignore" ||
    filePath.startsWith(".env") ||
    filePath === "package.json"
  )
    return 0;
  if (
    filePath === "vercel.json" ||
    filePath === "netlify.toml" ||
    filePath.startsWith("next.config")
  )
    return 1;

  if (filePath.includes("/api/") || filePath.includes("/pages/api/")) return 2;
  if (
    filePath.includes("auth") ||
    filePath.includes("login") ||
    filePath.includes("signup")
  )
    return 3;

  if (
    filePath.startsWith("src/") ||
    filePath.startsWith("app/") ||
    filePath.startsWith("pages/")
  )
    return 4;

  return 5;
}

export async function scanLocalDirectory(dir: string): Promise<RepoFile[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });

  const filePaths: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fullPath = join((entry as any).parentPath ?? (entry as any).path ?? dir, entry.name);
    const relPath = relative(dir, fullPath).replace(/\\/g, "/");
    if (shouldIncludeFile(relPath)) {
      filePaths.push(relPath);
    }
  }

  // Sort by priority and limit
  const sorted = filePaths
    .sort((a, b) => priorityScore(a) - priorityScore(b))
    .slice(0, MAX_FILES);

  // Read file contents
  const files: RepoFile[] = [];
  for (const relPath of sorted) {
    try {
      const content = await readFile(join(dir, relPath), "utf-8");
      files.push({ path: relPath, content });
    } catch {
      // Skip unreadable files
    }
  }

  return files;
}
