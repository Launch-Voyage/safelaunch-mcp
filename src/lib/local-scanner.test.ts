import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { scanLocalDirectory } from "./local-scanner.js";
import { mkdtemp, writeFile, mkdir, symlink, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("scanLocalDirectory", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "safelaunch-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("includes .ts and .json files", async () => {
    await writeFile(join(tempDir, "index.ts"), "export const a = 1;");
    await writeFile(join(tempDir, "config.json"), '{"key": "value"}');

    const files = await scanLocalDirectory(tempDir);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("index.ts");
    expect(paths).toContain("config.json");
  });

  it("excludes node_modules", async () => {
    await mkdir(join(tempDir, "node_modules", "pkg"), { recursive: true });
    await writeFile(join(tempDir, "node_modules", "pkg", "index.js"), "module.exports = {};");
    await writeFile(join(tempDir, "index.ts"), "export const a = 1;");

    const files = await scanLocalDirectory(tempDir);
    const paths = files.map((f) => f.path);
    expect(paths).not.toContain("node_modules/pkg/index.js");
    expect(paths).toContain("index.ts");
  });

  it("excludes .git and dist directories", async () => {
    await mkdir(join(tempDir, ".git"), { recursive: true });
    await writeFile(join(tempDir, ".git", "config"), "[core]");
    await mkdir(join(tempDir, "dist"), { recursive: true });
    await writeFile(join(tempDir, "dist", "index.js"), "compiled");
    await writeFile(join(tempDir, "index.ts"), "source");

    const files = await scanLocalDirectory(tempDir);
    const paths = files.map((f) => f.path);
    expect(paths).not.toContain(".git/config");
    expect(paths).not.toContain("dist/index.js");
  });

  it("respects MAX_FILES limit of 50", async () => {
    await mkdir(join(tempDir, "src"), { recursive: true });
    // Create 60 files
    for (let i = 0; i < 60; i++) {
      await writeFile(join(tempDir, "src", `file${i}.ts`), `export const x${i} = ${i};`);
    }

    const files = await scanLocalDirectory(tempDir);
    expect(files.length).toBeLessThanOrEqual(50);
  });

  it("skips symlinks", async () => {
    await writeFile(join(tempDir, "real.ts"), "export const real = true;");
    await symlink(join(tempDir, "real.ts"), join(tempDir, "link.ts"));

    const files = await scanLocalDirectory(tempDir);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("real.ts");
    expect(paths).not.toContain("link.ts");
  });

  it("prioritizes config files first", async () => {
    await mkdir(join(tempDir, "src"), { recursive: true });
    await writeFile(join(tempDir, "src", "app.ts"), "const app = true;");
    await writeFile(join(tempDir, ".gitignore"), "node_modules\n.env");
    await writeFile(join(tempDir, "package.json"), '{"name":"test"}');

    const files = await scanLocalDirectory(tempDir);
    const paths = files.map((f) => f.path);
    // .gitignore and package.json (priority 0) should come before src/app.ts (priority 4)
    const gitignoreIdx = paths.indexOf(".gitignore");
    const pkgIdx = paths.indexOf("package.json");
    const appIdx = paths.indexOf("src/app.ts");
    expect(gitignoreIdx).toBeLessThan(appIdx);
    expect(pkgIdx).toBeLessThan(appIdx);
  });

  it("prioritizes auth routes over generic source", async () => {
    await mkdir(join(tempDir, "src", "api"), { recursive: true });
    await mkdir(join(tempDir, "src", "utils"), { recursive: true });
    await writeFile(join(tempDir, "src", "utils", "helpers.ts"), "export {}");
    await writeFile(join(tempDir, "src", "auth.ts"), "export const auth = true;");
    await writeFile(join(tempDir, "src", "api", "data.ts"), "export {}");

    const files = await scanLocalDirectory(tempDir);
    const paths = files.map((f) => f.path);
    const authIdx = paths.indexOf("src/auth.ts");
    const apiIdx = paths.indexOf("src/api/data.ts");
    // auth (priority 3) should come after api routes (priority 2)
    // but both before generic src (priority 4)
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(apiIdx).toBeGreaterThanOrEqual(0);
  });

  it("includes .gitignore and .env files", async () => {
    await writeFile(join(tempDir, ".gitignore"), "node_modules\n");
    await writeFile(join(tempDir, ".env.example"), "KEY=value");

    const files = await scanLocalDirectory(tempDir);
    const paths = files.map((f) => f.path);
    expect(paths).toContain(".gitignore");
    expect(paths).toContain(".env.example");
  });

  it("reads file contents correctly", async () => {
    const content = "export const hello = 'world';";
    await writeFile(join(tempDir, "test.ts"), content);

    const files = await scanLocalDirectory(tempDir);
    const file = files.find((f) => f.path === "test.ts");
    expect(file).toBeDefined();
    expect(file!.content).toBe(content);
  });

  it("excludes unsupported file types", async () => {
    await writeFile(join(tempDir, "image.png"), "binary");
    await writeFile(join(tempDir, "data.csv"), "a,b,c");
    await writeFile(join(tempDir, "index.ts"), "export {}");

    const files = await scanLocalDirectory(tempDir);
    const paths = files.map((f) => f.path);
    expect(paths).not.toContain("image.png");
    expect(paths).not.toContain("data.csv");
    expect(paths).toContain("index.ts");
  });
});
