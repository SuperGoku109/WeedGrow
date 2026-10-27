import { z } from "zod";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assertFirestoreEmulatorHost } from "../firebase.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const inputSchema = z
  .object({
    profile: z.string().trim().min(1).optional(),
  })
  .strict();

function logInfo(message: string) {
  console.log(`[weedgrow-mcp] ${message}`);
}

function resolvePackageRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "..", "..");
}

function resolveRepoRoot(): string {
  if (process.env.WEEDGROW_REPO_ROOT) {
    return path.resolve(process.env.WEEDGROW_REPO_ROOT);
  }
  const packageRoot = resolvePackageRoot();
  return path.resolve(packageRoot, "..", "..");
}

function resolveStateDir(repoRoot: string): string {
  if (process.env.WEEDGROW_EMULATOR_STATE_DIR) {
    return path.resolve(process.env.WEEDGROW_EMULATOR_STATE_DIR);
  }
  return path.join(repoRoot, ".firebase-emulator", "state");
}

async function resetEmulatorState(stateDir: string, repoRoot: string) {
  const resolvedState = path.resolve(stateDir);
  const resolvedRoot = path.resolve(repoRoot);
  if (!resolvedState.startsWith(resolvedRoot + path.sep)) {
    throw new Error(
      `Refusing to delete state dir outside repo root: ${resolvedState}`
    );
  }
  if (!resolvedState.includes(`${path.sep}.firebase-emulator${path.sep}`)) {
    throw new Error(
      `State dir must be inside .firebase-emulator. Received: ${resolvedState}`
    );
  }

  try {
    await fs.rm(resolvedState, { recursive: true, force: true });
    return { deleted: true, path: resolvedState };
  } catch (error) {
    throw new Error(`Failed to delete emulator state: ${(error as Error).message}`);
  }
}

type SeedResult = {
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

async function runSeedScript(profile: string | undefined) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = ["run", "seed:emulator"];

  const allowlistedCommand = npmCommand;
  const allowlistedArgs = new Set(["run", "seed:emulator"]);

  if (npmCommand !== allowlistedCommand || args.some((arg) => !allowlistedArgs.has(arg))) {
    throw new Error("Seed command did not match allowlist.");
  }

  const packageRoot = resolvePackageRoot();
  const env = {
    ...process.env,
    WEEDGROW_SEED_PROFILE: profile || "",
  };

  logInfo(`Running seed script: ${npmCommand} ${args.join(" ")}`);

  return await new Promise<SeedResult>((resolve, reject) => {
    const child = spawn(npmCommand, args, {
      cwd: packageRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk.toString()));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk.toString()));

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      const stdout = stdoutChunks.join("").trim();
      const stderr = stderrChunks.join("").trim();
      resolve({
        command: npmCommand,
        args,
        exitCode: code,
        stdout,
        stderr,
      });
    });
  });
}

export function registerEmulatorResetAndSeed(server: McpServer) {
  server.tool(
    "emulatorResetAndSeed",
    "Reset emulator state directory and re-seed Firestore against the emulator.",
    inputSchema.shape,
    async (input) => {
      const parsed = inputSchema.parse(input ?? {});
      const emulator = assertFirestoreEmulatorHost();
      const repoRoot = resolveRepoRoot();
      const stateDir = resolveStateDir(repoRoot);

      logInfo(`Using Firestore emulator at ${emulator.raw}`);
      logInfo(`Resetting emulator state dir: ${stateDir}`);

      const resetResult = await resetEmulatorState(stateDir, repoRoot);
      const seedResult = await runSeedScript(parsed.profile);

      if (seedResult.exitCode !== 0) {
        throw new Error(
          `Seed script failed with exit code ${seedResult.exitCode}. ${seedResult.stderr}`
        );
      }

      const result = {
        emulatorHost: emulator.raw,
        stateDir: resetResult.path,
        seed: {
          command: seedResult.command,
          args: seedResult.args,
          exitCode: seedResult.exitCode,
          stdout: seedResult.stdout,
          stderr: seedResult.stderr,
        },
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      };
    }
  );
}
