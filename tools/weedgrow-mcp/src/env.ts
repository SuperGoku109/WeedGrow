import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

let loaded = false;

function logInfo(message: string) {
  console.log(`[weedgrow-mcp] ${message}`);
}

function resolvePackageRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "..");
}

function resolveRepoRoot(packageRoot: string): string {
  return path.resolve(packageRoot, "..", "..");
}

function tryLoadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath });
    logInfo(`Loaded env from ${filePath}`);
    return true;
  }
  return false;
}

export function loadEnv() {
  if (loaded) return;
  loaded = true;

  const packageRoot = resolvePackageRoot();
  const repoRoot = resolveRepoRoot(packageRoot);

  const candidates: string[] = [];

  if (process.env.WEEDGROW_MCP_ENV_FILE) {
    candidates.push(path.resolve(process.env.WEEDGROW_MCP_ENV_FILE));
  }

  candidates.push(path.join(packageRoot, ".env"));
  candidates.push(path.join(repoRoot, ".env"));
  candidates.push(path.join(repoRoot, "WeedGrowApp", ".env"));

  for (const candidate of candidates) {
    if (tryLoadEnvFile(candidate)) {
      return;
    }
  }
}