import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { basename, resolve } from "node:path";
import { chromium } from "playwright";
import { generateFixtureProfile } from "./generate-studio-audio-fixtures.mjs";

const profileName = argument("--profile", "controlled");
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
if (!profile) throw new Error(`Unsupported fixture profile: ${profileName}`);

const packageManifest = JSON.parse(
  readFileSync(resolve("package.json"), "utf8"),
);
const codecVersion = "1.50.8";
if (
  packageManifest.dependencies?.mediabunny !== codecVersion ||
  packageManifest.dependencies?.["@mediabunny/flac-encoder"] !== codecVersion
) {
  throw new Error(
    `The benchmark requires the production encoder pins at exactly ${codecVersion}.`,
  );
}

const inputDirectory = resolve("local", "opt01-audio-fixtures", profileName);
const outputDirectory = resolve("local", "opt05-audio-fixtures", profileName);
const inputs = Array.from({ length: profile.stems }, (_, index) =>
  resolve(inputDirectory, `stem-${String(index + 1).padStart(2, "0")}.wav`),
);
if (inputs.some((file) => !existsSync(file))) {
  generateFixtureProfile({ profileName, output: inputDirectory, ...profile });
}
mkdirSync(outputDirectory, { recursive: true });

const mediabunny = resolve(
  "node_modules",
  "mediabunny",
  "dist",
  "bundles",
  "mediabunny.mjs",
);
const flacEncoder = resolve(
  "node_modules",
  "@mediabunny",
  "flac-encoder",
  "dist",
  "bundles",
  "mediabunny-flac-encoder.mjs",
);
if (!existsSync(mediabunny) || !existsSync(flacEncoder)) {
  throw new Error("Run npm ci before generating browser FLAC fixtures.");
}

const outputNames = new Set(
  inputs.map((file) => basename(file).replace(/\.wav$/, ".flac")),
);
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (request.method === "GET" && url.pathname === "/") {
    response
      .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end(
        "<!doctype html><meta charset=utf-8><title>OPT-05 FLAC fixtures</title>",
      );
    return;
  }
  if (request.method === "GET" && url.pathname === "/deps/mediabunny.mjs") {
    serveFile(response, mediabunny, "text/javascript");
    return;
  }
  if (request.method === "GET" && url.pathname === "/deps/flac.mjs") {
    const source = readFileSync(flacEncoder, "utf8").replaceAll(
      'from "mediabunny"',
      'from "/deps/mediabunny.mjs"',
    );
    response.writeHead(200, { "Content-Type": "text/javascript" }).end(source);
    return;
  }
  if (request.method === "GET" && url.pathname === "/codec-worker.mjs") {
    response
      .writeHead(200, { "Content-Type": "text/javascript" })
      .end(codecWorkerSource());
    return;
  }
  const inputMatch = /^\/input\/(stem-\d{2}\.wav)$/.exec(url.pathname);
  if (request.method === "GET" && inputMatch) {
    const file = resolve(inputDirectory, inputMatch[1]);
    if (!inputs.includes(file)) {
      response.writeHead(404).end();
      return;
    }
    serveFile(response, file, "audio/wav");
    return;
  }
  const outputMatch = /^\/output\/(stem-\d{2}\.flac)$/.exec(url.pathname);
  if (
    request.method === "POST" &&
    outputMatch &&
    outputNames.has(outputMatch[1])
  ) {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const bytes = Buffer.concat(chunks);
      writeFileSync(resolve(outputDirectory, outputMatch[1]), bytes);
      response.writeHead(204).end();
    });
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolveListen) =>
  server.listen(0, "127.0.0.1", resolveListen),
);
const address = server.address();
if (!address || typeof address === "string")
  throw new Error("FLAC fixture server did not bind.");

const browser = await chromium.launch();
const results = [];
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  for (const input of inputs) {
    const inputName = basename(input);
    const outputName = inputName.replace(/\.wav$/, ".flac");
    const result = await page.evaluate(
      async ({ source, target }) => {
        const wav = await (await fetch(`/input/${source}`)).arrayBuffer();
        const worker = new Worker("/codec-worker.mjs", { type: "module" });
        const encoded = await new Promise((resolveWorker, rejectWorker) => {
          worker.onmessage = ({ data }) => {
            if (data.type === "done") resolveWorker(data);
            if (data.type === "error") rejectWorker(new Error(data.message));
          };
          worker.onerror = (event) => rejectWorker(new Error(event.message));
          worker.postMessage({ type: "start", bytes: wav }, [wav]);
        });
        worker.terminate();
        const signature = String.fromCharCode(
          ...new Uint8Array(encoded.bytes, 0, 4),
        );
        if (signature !== "fLaC") throw new Error("Invalid FLAC signature.");
        if (
          encoded.sourceMetadata.channels !== encoded.outputMetadata.channels ||
          encoded.sourceMetadata.sampleRate !==
            encoded.outputMetadata.sampleRate ||
          Math.abs(
            encoded.sourceMetadata.durationSeconds -
              encoded.outputMetadata.durationSeconds,
          ) >
            2 / encoded.sourceMetadata.sampleRate
        ) {
          throw new Error("The FLAC metadata does not match the source WAV.");
        }

        const sourceBytes = await (
          await fetch(`/input/${source}`)
        ).arrayBuffer();
        const audioContext = new AudioContext({
          sampleRate: encoded.sourceMetadata.sampleRate,
        });
        const [sourceAudio, outputAudio] = await Promise.all([
          audioContext.decodeAudioData(sourceBytes),
          audioContext.decodeAudioData(encoded.bytes.slice(0)),
        ]);
        if (
          sourceAudio.numberOfChannels !== outputAudio.numberOfChannels ||
          sourceAudio.length !== outputAudio.length ||
          sourceAudio.sampleRate !== outputAudio.sampleRate
        ) {
          throw new Error(
            "The decoded FLAC shape does not match the source WAV.",
          );
        }
        let maxSampleDelta = 0;
        let comparedSamples = 0;
        for (
          let channel = 0;
          channel < sourceAudio.numberOfChannels;
          channel += 1
        ) {
          const sourceChannel = sourceAudio.getChannelData(channel);
          const outputChannel = outputAudio.getChannelData(channel);
          comparedSamples += sourceChannel.length;
          for (let index = 0; index < sourceChannel.length; index += 1) {
            maxSampleDelta = Math.max(
              maxSampleDelta,
              Math.abs(sourceChannel[index] - outputChannel[index]),
            );
          }
        }
        await audioContext.close();
        if (maxSampleDelta !== 0) {
          throw new Error(
            `The decoded FLAC is not sample-equal (max delta ${maxSampleDelta}).`,
          );
        }
        const upload = await fetch(`/output/${target}`, {
          method: "POST",
          body: encoded.bytes,
        });
        if (!upload.ok)
          throw new Error("The generated FLAC could not be saved.");
        return {
          inputBytes: encoded.inputBytes,
          outputBytes: encoded.bytes.byteLength,
          outputRatio: encoded.bytes.byteLength / encoded.inputBytes,
          signature,
          conversionMilliseconds: encoded.conversionMilliseconds,
          peakGenerationMilliseconds: encoded.peakGenerationMilliseconds,
          peakBins: encoded.peakBins,
          decodedPcmEquality: { comparedSamples, maxSampleDelta },
          sourceMetadata: encoded.sourceMetadata,
          outputMetadata: encoded.outputMetadata,
        };
      },
      { source: inputName, target: outputName },
    );
    results.push({ input: inputName, output: outputName, ...result });
  }
} finally {
  await browser.close();
  server.close();
}

const evidence = {
  recordedAt: new Date().toISOString(),
  environment: { browser: "Playwright Chromium", codecVersion: "1.50.8" },
  fixtureNotice:
    "Ratios use deterministic synthetic tones/transients/noise and are controlled evidence, not representative compression promises for recorded music.",
  profile: { name: profileName, ...profile },
  results,
  summary: {
    inputBytes: results.reduce((sum, result) => sum + result.inputBytes, 0),
    outputBytes: results.reduce((sum, result) => sum + result.outputBytes, 0),
    conversionMilliseconds: results.reduce(
      (sum, result) => sum + result.conversionMilliseconds,
      0,
    ),
    peakGenerationMilliseconds: results.reduce(
      (sum, result) => sum + result.peakGenerationMilliseconds,
      0,
    ),
  },
};
const evidencePath = resolve(outputDirectory, "generation.json");
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({ output: evidencePath, summary: evidence.summary }, null, 2)}\n`,
);

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function serveFile(response, file, contentType) {
  response.writeHead(200, {
    "Content-Length": statSync(file).size,
    "Content-Type": contentType,
  });
  createReadStream(file).pipe(response);
}

function codecWorkerSource() {
  return String.raw`
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  FlacOutputFormat,
  Input,
  Output,
} from "/deps/mediabunny.mjs";
import { registerFlacEncoder } from "/deps/flac.mjs";

registerFlacEncoder();

self.onmessage = async ({ data }) => {
  try {
    const inputBytes = data.bytes.byteLength;
    const input = new Input({
      source: new BlobSource(new Blob([data.bytes], { type: "audio/wav" })),
      formats: ALL_FORMATS,
    });
    const sourceTrack = await input.getPrimaryAudioTrack();
    if (!sourceTrack) throw new Error("The WAV has no audio track.");
    const sourceMetadata = {
      durationSeconds: await input.computeDuration(),
      channels: await sourceTrack.getNumberOfChannels(),
      sampleRate: await sourceTrack.getSampleRate(),
    };
    const bins = 2048;
    const totalFrames = Math.max(
      1,
      Math.ceil(sourceMetadata.durationSeconds * sourceMetadata.sampleRate),
    );
    const peaks = new Float32Array(sourceMetadata.channels * bins * 2);
    for (let index = 0; index < peaks.length; index += 2) {
      peaks[index] = 1;
      peaks[index + 1] = -1;
    }
    const target = new BufferTarget();
    const output = new Output({ format: new FlacOutputFormat(), target });
    let peakGenerationMilliseconds = 0;
    const conversion = await Conversion.init({
      input,
      output,
      audio: {
        forceTranscode: true,
        process: (sample) => {
          const peakStartedAt = performance.now();
          const startFrame = Math.max(
            0,
            Math.round(sample.timestamp * sourceMetadata.sampleRate),
          );
          for (let channel = 0; channel < sourceMetadata.channels; channel += 1) {
            const channelData = new Float32Array(sample.numberOfFrames);
            sample.copyTo(channelData, {
              planeIndex: channel,
              format: "f32-planar",
            });
            for (let frame = 0; frame < channelData.length; frame += 1) {
              const bin = Math.min(
                bins - 1,
                Math.floor(((startFrame + frame) / totalFrames) * bins),
              );
              const offset = (channel * bins + bin) * 2;
              const value = Math.max(-1, Math.min(1, channelData[frame] ?? 0));
              peaks[offset] = Math.min(peaks[offset] ?? 1, value);
              peaks[offset + 1] = Math.max(peaks[offset + 1] ?? -1, value);
            }
          }
          peakGenerationMilliseconds += performance.now() - peakStartedAt;
          return sample;
        },
      },
    });
    const startedAt = performance.now();
    await conversion.execute();
    const conversionMilliseconds = performance.now() - startedAt;
    const bytes = target.buffer;
    if (!bytes) throw new Error("The FLAC encoder returned no bytes.");
    const verificationInput = new Input({
      source: new BlobSource(new Blob([bytes], { type: "audio/flac" })),
      formats: ALL_FORMATS,
    });
    const verificationTrack = await verificationInput.getPrimaryAudioTrack();
    if (!verificationTrack) throw new Error("The FLAC has no audio track.");
    const outputMetadata = {
      durationSeconds: await verificationInput.computeDuration(),
      channels: await verificationTrack.getNumberOfChannels(),
      sampleRate: await verificationTrack.getSampleRate(),
    };
    self.postMessage(
      {
        type: "done",
        bytes,
        inputBytes,
        conversionMilliseconds,
        peakGenerationMilliseconds,
        peakBins: bins,
        sourceMetadata,
        outputMetadata,
      },
      [bytes],
    );
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
`;
}
