import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync, cpSync } from "node:fs";
import getPort from "get-port";
import treeKill from "tree-kill";
import type { ThirdpartyServices } from "./thirdparty-services";

export type NextVersion = "next15" | "next16";

const NEXT_VERSIONS: Record<NextVersion, string> = {
  next15: "^15.0.0",
  next16: "^16.0.0",
};

/**
 * Handles installing, building, and running a Next.js test app.
 */
export class TestAppLauncher {
  private version: NextVersion;
  private services: ThirdpartyServices;
  private appProcess: ChildProcess | null = null;
  private port: number = 0;

  readonly appDir: string;
  readonly corePackageDir: string;

  constructor(version: NextVersion, services: ThirdpartyServices) {
    this.version = version;
    this.services = services;
    this.appDir = join(import.meta.dirname, "..", "test-app");
    this.corePackageDir = join(import.meta.dirname, "..", "..", "packages", "core");
  }

  get baseUrl(): string {
    return `http://localhost:${this.port}`;
  }

  get nextVersion(): NextVersion {
    return this.version;
  }

  private setNextVersion(): void {
    const pkgPath = join(this.appDir, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    pkg.dependencies.next = NEXT_VERSIONS[this.version];
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }

  private cleanInstall(): void {
    const nodeModules = join(this.appDir, "node_modules");
    const nextDir = join(this.appDir, ".next");
    const lockFile = join(this.appDir, "package-lock.json");

    if (existsSync(nodeModules)) rmSync(nodeModules, { recursive: true });
    if (existsSync(nextDir)) rmSync(nextDir, { recursive: true });
    if (existsSync(lockFile)) rmSync(lockFile);
  }

  private installNextlyticsCore(): void {
    // Copy @nextlytics/core into node_modules
    const targetDir = join(this.appDir, "node_modules", "@nextlytics", "core");

    // Ensure parent directory exists
    mkdirSync(join(this.appDir, "node_modules", "@nextlytics"), { recursive: true });

    // Copy dist folder and package.json
    cpSync(join(this.corePackageDir, "dist"), join(targetDir, "dist"), { recursive: true });
    cpSync(join(this.corePackageDir, "package.json"), join(targetDir, "package.json"));
  }

  async install(): Promise<void> {
    console.log(`Setting Next.js version to ${NEXT_VERSIONS[this.version]}...`);
    this.setNextVersion();

    console.log(`Cleaning previous install...`);
    this.cleanInstall();

    console.log(`Installing dependencies with npm...`);
    await this.runCommand("npm", ["install"]);

    console.log(`Installing @nextlytics/core from local build...`);
    this.installNextlyticsCore();
  }

  async build(): Promise<void> {
    console.log(`Building ${this.version}...`);
    await this.runCommand("npm", ["run", "build"]);
  }

  async start(): Promise<void> {
    this.port = await getPort();
    console.log(`Starting ${this.version} on port ${this.port}...`);

    this.appProcess = spawn("npm", ["run", "start", "--", "-p", String(this.port)], {
      cwd: this.appDir,
      env: {
        ...process.env,
        POSTGREST_URL: this.services.postgrestUrl,
        TEST_USER_USERNAME: "testuser",
        TEST_USER_PASSWORD: "testpass",
        AUTH_SECRET: "test-secret-for-e2e-testing-only",
        NEXTAUTH_URL: `http://localhost:${this.port}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.appProcess.stdout?.on("data", (data) => {
      const msg = data.toString();
      if (process.env.DEBUG) console.log(`[${this.version}] ${msg}`);
    });

    this.appProcess.stderr?.on("data", (data) => {
      const msg = data.toString();
      if (process.env.DEBUG) console.error(`[${this.version}] ${msg}`);
    });

    await this.waitForServer();
  }

  private async waitForServer(maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${this.baseUrl}/api/auth/session`);
        if (response.ok) {
          console.log(`Server ready at ${this.baseUrl}`);
          return;
        }
      } catch {
        // Server not ready yet
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(`Server failed to start after ${maxAttempts} seconds`);
  }

  async stop(): Promise<void> {
    if (this.appProcess?.pid) {
      console.log(`Stopping ${this.version}...`);
      await new Promise<void>((resolve) => {
        treeKill(this.appProcess!.pid!, "SIGTERM", () => resolve());
      });
      this.appProcess = null;
    }
  }

  private runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: this.appDir,
        stdio: "inherit",
        env: process.env,
      });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
      });
      proc.on("error", reject);
    });
  }
}
