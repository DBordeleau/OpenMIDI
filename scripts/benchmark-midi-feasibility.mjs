import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const port = 3200;
const origin = `http://127.0.0.1:${port}`;
const nextBin = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);
const server = spawn(
  process.execPath,
  [nextBin, "dev", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    cwd: new URL("..", import.meta.url),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let serverOutput = "";
server.stdout.on("data", (chunk) => (serverOutput += chunk.toString()));
server.stderr.on("data", (chunk) => (serverOutput += chunk.toString()));

try {
  await waitForServer();
  const browser = await chromium.launch();
  try {
    const runs = [];
    for (let index = 0; index < 5; index += 1) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      const navigationStart = performance.now();
      await page.goto(`${origin}/midi-feasibility?run=${index + 1}`, {
        waitUntil: "networkidle",
      });
      const shellReadyMs = performance.now() - navigationStart;
      const scheduler = await page
        .locator("section")
        .filter({ hasText: "Deterministic scheduler" })
        .locator("li")
        .allTextContents();
      await page.getByRole("button", { name: "Audition preset" }).click();
      await page.getByRole("status").filter({ hasText: "Ready in" }).waitFor();
      const audition = await page.getByRole("status").textContent();
      await page.getByRole("button", { name: "Benchmark all presets" }).click();
      await page
        .getByRole("status")
        .filter({ hasText: "All seven preset graphs" })
        .waitFor();
      const presets = await page
        .locator("section")
        .filter({ hasText: "Sample-free Tone.js presets" })
        .locator("li")
        .allTextContents();
      runs.push({
        run: index + 1,
        shellReadyMs,
        scheduler,
        audition,
        presets,
        errors,
      });
      await context.close();
    }
    process.stdout.write(
      `${JSON.stringify({ browser: "chromium", runs }, null, 2)}\n`,
    );
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error(`Dev server exited early:\n${serverOutput}`);
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The dev server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for dev server:\n${serverOutput}`);
}
