import {
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { generateFixtureProfile } from "./generate-studio-audio-fixtures.mjs";

const profileName = argument("--profile", "controlled");
const repetitions = Number(argument("--repetitions", "5"));
const phase = argument("--phase", "both");
const loader = argument("--loader", "current");
const output = resolve(
  argument(
    "--output",
    `local/opt01-results/delivery-${profileName}-${new Date().toISOString().replaceAll(":", "-")}.json`,
  ),
);
const profileDefinitions = {
  controlled: {
    stems: 3,
    durationSeconds: 180,
    sampleRate: 44_100,
    bitDepth: 24,
  },
  stress: { stems: 12, durationSeconds: 180, sampleRate: 44_100, bitDepth: 24 },
  boundary: {
    stems: 1,
    durationSeconds: 590,
    sampleRate: 32_000,
    bitDepth: 16,
  },
};
const profile = profileDefinitions[profileName];
if (!profile) throw new Error(`Unsupported benchmark profile: ${profileName}`);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10)
  throw new Error("Repetitions must be an integer from 1 to 10.");
if (!["both", "cold", "warm"].includes(phase))
  throw new Error("Phase must be both, cold, or warm.");
if (!["current", "progressive"].includes(loader))
  throw new Error("Loader must be current or progressive.");

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const fixtureDirectory = resolve("local", "opt01-audio-fixtures", profileName);
const expected = Array.from({ length: profile.stems }, (_, index) =>
  resolve(fixtureDirectory, `stem-${String(index + 1).padStart(2, "0")}.wav`),
);
if (expected.some((file) => !existsSync(file))) {
  generateFixtureProfile({ profileName, output: fixtureDirectory, ...profile });
}

const server = createServer((request, response) => {
  const match = /^\/audio\/(stem-\d{2}\.wav)$/.exec(request.url ?? "");
  if (!match) {
    response.writeHead(404).end();
    return;
  }
  const file = resolve(fixtureDirectory, match[1]);
  if (!expected.includes(file)) {
    response.writeHead(404).end();
    return;
  }
  const size = statSync(file).size;
  response.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "private, max-age=3600",
    "Content-Length": size,
    "Content-Type": "audio/wav",
  });
  createReadStream(file).pipe(response);
});
await new Promise((resolveListen) =>
  server.listen(0, "127.0.0.1", resolveListen),
);
const address = server.address();
if (!address || typeof address === "string")
  throw new Error("Benchmark server did not bind.");
const urls = expected.map(
  (file) => `http://127.0.0.1:${address.port}/audio/${basename(file)}`,
);

const browser = await chromium.launch();
const results = { cold: [], warm: [] };
try {
  if (phase !== "warm") {
    for (let index = 0; index < repetitions; index += 1) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const session = await context.newCDPSession(page);
      await session.send("Network.enable");
      await session.send("Network.setCacheDisabled", { cacheDisabled: true });
      await session.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 50,
        downloadThroughput: 2_500_000,
        uploadThroughput: 625_000,
        connectionType: "cellular4g",
      });
      results.cold.push(await runLoader(page, urls, loader));
      await context.close();
    }
  }

  if (phase !== "cold") {
    const context = await browser.newContext();
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send("Network.enable");
    await session.send("Network.setCacheDisabled", { cacheDisabled: false });
    await session.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 50,
      downloadThroughput: 2_500_000,
      uploadThroughput: 625_000,
      connectionType: "cellular4g",
    });
    if (loader === "progressive") await runLoader(page, urls, loader);
    for (let index = 0; index < repetitions; index += 1) {
      results.warm.push(await runLoader(page, urls, loader));
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

const evidence = {
  recordedAt: new Date().toISOString(),
  environment: {
    browser: "Playwright Chromium",
    downstreamBitsPerSecond: 20_000_000,
    upstreamBitsPerSecond: 5_000_000,
    latencyMilliseconds: 50,
    loader,
    fetchCacheMode: loader === "current" ? "no-store" : "default",
  },
  profile: {
    name: profileName,
    ...profile,
    files: expected.map((file) => ({
      name: basename(file),
      bytes: statSync(file).size,
    })),
  },
  repetitions,
  phase,
  results,
  summary: {
    cold: results.cold.length > 0 ? summarize(results.cold) : null,
    warm: results.warm.length > 0 ? summarize(results.warm) : null,
  },
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({ output, summary: evidence.summary }, null, 2)}\n`,
);

async function runLoader(page, sourceUrls, loaderName) {
  return page.evaluate(
    async ({ inputUrls, loaderName: selectedLoader }) => {
      const startedAt = performance.now();
      const longTasks = [];
      const observer =
        typeof PerformanceObserver !== "undefined"
          ? new PerformanceObserver((list) => {
              for (const entry of list.getEntries())
                longTasks.push(entry.duration);
            })
          : null;
      try {
        observer?.observe({ type: "longtask", buffered: true });
      } catch {
        // Long-task entries are optional capability evidence.
      }
      const context = new AudioContext();
      const shellReadyAt =
        selectedLoader === "progressive" ? performance.now() : null;
      const registry =
        selectedLoader === "progressive"
          ? (window.__jamSessionBenchmarkRegistry ??= new Map())
          : null;
      let cursor = 0;
      const sources = [];
      const worker = async () => {
        while (true) {
          const sourceIndex = cursor++;
          const url = inputUrls[sourceIndex];
          if (!url) return;
          let reused = false;
          let transferredBytes = 0;
          const fetchStart = performance.now();
          let sourcePromise = registry?.get(url);
          if (sourcePromise) reused = true;
          else {
            sourcePromise = (async () => {
              const response = await fetch(url, {
                cache: selectedLoader === "current" ? "no-store" : "default",
              });
              const bytes = await response.arrayBuffer();
              const byteLength = bytes.byteLength;
              const fetchEnd = performance.now();
              const decodeStart = performance.now();
              const buffer = await context.decodeAudioData(bytes);
              return { buffer, bytes: byteLength, fetchEnd, decodeStart };
            })();
            registry?.set(url, sourcePromise);
          }
          const loaded = await sourcePromise;
          if (!reused) transferredBytes = loaded.bytes;
          const decodeEnd = performance.now();
          sources.push({
            sourceIndex,
            bytes: loaded.bytes,
            transferredBytes,
            reused,
            fetchMilliseconds: reused ? 0 : loaded.fetchEnd - fetchStart,
            decodeMilliseconds: reused ? 0 : decodeEnd - loaded.decodeStart,
            readyMilliseconds: decodeEnd - startedAt,
            channels: loaded.buffer.numberOfChannels,
            sampleRate: loaded.buffer.sampleRate,
            durationSeconds: loaded.buffer.duration,
          });
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(3, inputUrls.length) }, () => worker()),
      );
      const readyAt = performance.now();
      await context.close();
      observer?.disconnect();
      return {
        shellReadyMilliseconds: (shellReadyAt ?? readyAt) - startedAt,
        peaksReadyMilliseconds: readyAt - startedAt,
        playbackReadyMilliseconds: readyAt - startedAt,
        slowestLongTaskMilliseconds: Math.max(0, ...longTasks),
        usedJsHeapBytes:
          "memory" in performance ? performance.memory.usedJSHeapSize : null,
        sources: sources.sort(
          (left, right) => left.sourceIndex - right.sourceIndex,
        ),
      };
    },
    { inputUrls: sourceUrls, loaderName },
  );
}

function summarize(runs) {
  const playback = runs
    .map((run) => run.playbackReadyMilliseconds)
    .sort((left, right) => left - right);
  const median = playback[Math.floor(playback.length / 2)];
  const shell = runs
    .map((run) => run.shellReadyMilliseconds)
    .sort((left, right) => left - right);
  return {
    medianPlaybackReadyMilliseconds: Math.round(median),
    slowestPlaybackReadyMilliseconds: Math.round(playback.at(-1)),
    medianShellReadyMilliseconds: Math.round(
      shell[Math.floor(shell.length / 2)],
    ),
    slowestShellReadyMilliseconds: Math.round(shell.at(-1)),
    medianTransferredBytesPerRun: runs
      .map((run) =>
        run.sources.reduce((sum, source) => sum + source.transferredBytes, 0),
      )
      .sort((left, right) => left - right)[Math.floor(runs.length / 2)],
    slowestLongTaskMilliseconds: Math.round(
      Math.max(...runs.map((run) => run.slowestLongTaskMilliseconds)),
    ),
  };
}
