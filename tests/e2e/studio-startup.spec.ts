import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  serializeWaveformPeaks,
  WAVEFORM_PEAKS_BIN_COUNT,
} from "../../src/features/assets/waveform-peaks/contract";

test.describe("studio startup smoke", () => {
  let closeFixtureDelivery: (() => Promise<void>) | null = null;

  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await closeFixtureDelivery?.();
    closeFixtureDelivery = null;
  });

  test("opens the authenticated start center without starting browser audio", async ({
    page,
  }) => {
    await ensureStudioActorProfile();
    await page.addInitScript(() => {
      const state = window as Window & {
        __jamAudioContextConstructions?: number;
      };
      state.__jamAudioContextConstructions = 0;
      for (const name of ["AudioContext", "webkitAudioContext"] as const) {
        const original = window[name as keyof Window];
        if (typeof original !== "function") continue;
        Object.defineProperty(window, name, {
          configurable: true,
          value: new Proxy(original, {
            construct(target, argumentsList, newTarget) {
              state.__jamAudioContextConstructions =
                (state.__jamAudioContextConstructions ?? 0) + 1;
              return Reflect.construct(target, argumentsList, newTarget);
            },
          }),
        });
      }
    });

    await page.goto("/studio");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fstudio$/);
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);

    const privateSourceRequests: string[] = [];
    page.on("request", (request) => {
      if (/audio-sources|storage\/v1\/object/i.test(request.url()))
        privateSourceRequests.push(request.url());
    });
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Studio" })
      .click();

    await expect(page).toHaveURL(/\/studio$/);
    await expect(
      page.getByRole("heading", { name: "Open the music you want to shape." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "New project" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open project" }).first(),
    ).toBeVisible();
    expect(privateSourceRequests).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          (window as Window & { __jamAudioContextConstructions?: number })
            .__jamAudioContextConstructions ?? 0,
      ),
    ).toBe(0);
  });

  test("opens an editable published revision in one navigation", async ({
    page,
  }) => {
    test.setTimeout(75_000);
    const { peakBytes, sourceBytes, ...fixture } = await setupStudioFixture();
    const delivery = await startFixtureDelivery(sourceBytes, peakBytes);
    closeFixtureDelivery = delivery.close;

    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);

    // Local Storage on Windows/Docker can return signed-object headers while
    // stalling the response body. The preflight below verifies both real
    // objects. Keep the real authorized descriptor/signing request, assert its
    // private paths, then point only this fixture at deterministic loopback
    // responses containing those exact bytes.
    const fixtureSourceUrl = delivery.sourceUrl;
    const fixturePeakUrl = delivery.peakUrl;
    await page.route(
      new RegExp(
        `/api/projects/${fixture.projectId}/workspaces/[^/]+/audio-sources$`,
      ),
      async (route) => {
        const response = await route.fetch();
        if (!response.ok()) {
          await route.fulfill({ response });
          return;
        }
        const payload = (await response.json()) as {
          sources?: Array<{
            assetId: string;
            signedUrl: string;
            peaks: { signedUrl: string } | null;
          }>;
        };
        const source = payload.sources?.find(
          (candidate) => candidate.assetId === fixture.assetId,
        );
        if (!source?.peaks)
          throw new Error("The authorized fixture descriptor omitted peaks.");
        const sourcePath = new URL(source.signedUrl).pathname;
        const peakPath = new URL(source.peaks.signedUrl).pathname;
        if (
          !sourcePath.includes("/object/sign/source-audio/") ||
          !sourcePath.endsWith(`/${fixture.assetId}/source`) ||
          !peakPath.includes("/object/sign/derived-assets/") ||
          !peakPath.includes(`/${fixture.assetId}/`)
        )
          throw new Error(
            `The fixture descriptor returned unexpected private paths: ${JSON.stringify({ sourcePath, peakPath })}`,
          );
        source.signedUrl = fixtureSourceUrl;
        source.peaks.signedUrl = fixturePeakUrl;
        await route.fulfill({ response, json: payload });
      },
    );

    const networkEvents: NetworkEvent[] = [];
    page.on("request", (request) => {
      recordNetworkEvent(networkEvents, "request", request.url(), {
        method: request.method(),
      });
    });
    page.on("response", (response) => {
      recordNetworkEvent(networkEvents, "response", response.url(), {
        method: response.request().method(),
        status: response.status(),
      });
    });
    page.on("requestfailed", (request) => {
      recordNetworkEvent(networkEvents, "requestfailed", request.url(), {
        method: request.method(),
        error: request.failure()?.errorText ?? "unknown",
      });
    });
    await page.goto(`/projects/${fixture.projectId}/studio`);
    await expect(page).toHaveURL(`/studio/${fixture.projectId}`);
    await expect(page.getByText("Private draft from revision 1")).toBeVisible();
    await expect(page.getByLabel("Fixture stem label")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText("Waveform ready from persisted peaks."),
      `Persisted peaks did not become ready: ${JSON.stringify({ fixture, networkEvents })}`,
    ).toBeAttached({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: "Play playback" }),
      `Fixture audio did not become playable: ${JSON.stringify({ fixture, networkEvents })}`,
    ).toBeEnabled({ timeout: 15_000 });

    const trackLabel = page.getByLabel("Fixture stem label");
    await trackLabel.fill("Saved browser stem");
    await trackLabel.press("Tab");
    await expect(
      page.locator('[aria-live="polite"]').filter({ hasText: "Status: Saved" }),
    ).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByLabel("Saved browser stem label")).toHaveValue(
      "Saved browser stem",
      { timeout: 30_000 },
    );
  });
});

async function ensureStudioActorProfile() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.TEST_AUTH_EMAIL;
  if (!url?.startsWith("http://127.0.0.1:") || !serviceRoleKey || !email)
    throw new Error(
      "Studio actor setup requires npm run test:e2e:studio against local Supabase.",
    );
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  const actor = users.users.find((user) => user.email === email);
  if (!actor)
    throw new Error("Local E2E actor setup did not create the actor.");
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_jam-session",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `update public.profiles set username='StudioE2EActor', username_normalized='studioe2eactor', display_name='Studio E2E actor', credit_name='Studio E2E actor', profile_completed_at=coalesce(profile_completed_at,now()) where id='${actor.id}'`,
    ],
    { encoding: "utf8" },
  );
}

async function setupStudioFixture() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.TEST_AUTH_EMAIL;
  if (!url?.startsWith("http://127.0.0.1:") || !serviceRoleKey || !email)
    throw new Error(
      "Studio fixture preflight requires npm run test:e2e:studio against local Supabase.",
    );
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw usersError;
  const actor = users.users.find((user) => user.email === email);
  if (!actor)
    throw new Error("Local E2E actor setup did not create the actor.");

  const projectId = randomUUID();
  const revisionId = randomUUID();
  const assetId = randomUUID();
  const derivativeId = randomUUID();
  const trackId = randomUUID();
  const sourcePath = path.join(
    process.cwd(),
    "public",
    "fixtures",
    "audio",
    "stem-a.wav",
  );
  const bytes = await readFile(sourcePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const peakValues = new Float32Array(WAVEFORM_PEAKS_BIN_COUNT * 2);
  const peakBytes = serializeWaveformPeaks({
    sourceAssetId: assetId,
    channels: 1,
    durationMs: 2_000,
    sampleRateHz: 44_100,
    binCount: WAVEFORM_PEAKS_BIN_COUNT,
    values: peakValues,
  });
  const peakSha256 = createHash("sha256").update(peakBytes).digest("hex");
  const peakObjectPath = `${actor.id}/${assetId}/${derivativeId}/peaks.v1.bin`;
  const manifest = JSON.stringify({
    manifestVersion: 1,
    engine: "waveform-playlist",
    engineVersion: "browser-15.3.4_playout-12.5.4_tone-15.1.22",
    workspaceId: projectId,
    tempoBpm: 120,
    tracks: [
      {
        trackId,
        assetId,
        instrumentId: null,
        name: "Fixture stem",
        positionMs: 0,
        trimStartMs: 0,
        durationMs: 2000,
        gainDb: 0,
        pan: 0,
        muted: false,
        soloed: false,
        sortOrder: 0,
      },
    ],
  }).replaceAll("'", "''");
  const sql = `begin;
    update public.profiles set username='StudioE2EActor', username_normalized='studioe2eactor', display_name='Studio E2E actor', credit_name='Studio E2E actor', profile_completed_at=coalesce(profile_completed_at,now()) where id='${actor.id}';
    insert into public.projects(id,owner_id,create_request_id,title,bpm,license_code) values('${projectId}','${actor.id}','${randomUUID()}','Studio startup fixture',120,'cc-by-4.0');
    insert into public.project_members(project_id,user_id,role,created_by) values('${projectId}','${actor.id}','owner','${actor.id}');
    set constraints all immediate; set constraints all deferred;
    insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at) values('${assetId}','${actor.id}','ready','${actor.id}/${assetId}/source','stem-a.wav',${bytes.byteLength},'audio/wav',${bytes.byteLength},'${sha256}',2000,44100,1,'playwright-fixture-v1',now());
    insert into public.asset_credits(asset_id,position,user_id,credit_name,role) values('${assetId}',0,'${actor.id}','Studio E2E actor','creator');
    update public.assets set credits_confirmed_at=ready_at,credits_confirmation_request_id=id,credits_confirmation_sha256=repeat('c',64) where id='${assetId}';
    insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms) values('${revisionId}','${projectId}',1,'${actor.id}','${randomUUID()}','Fixture revision','${manifest}'::jsonb,1,'waveform-playlist','browser-15.3.4_playout-12.5.4_tone-15.1.22',encode(extensions.digest(convert_to('${manifest}'::jsonb::text,'UTF8'),'sha256'),'hex'),2000);
    insert into public.revision_tracks(revision_id,id,asset_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,added_by) values('${revisionId}','${trackId}','${assetId}','Fixture stem',0,0,2000,0,0,false,false,0,'${actor.id}');
    insert into public.project_asset_references(project_id,asset_id,first_revision_id,added_by) values('${projectId}','${assetId}','${revisionId}','${actor.id}');
    insert into public.project_storage_usage(project_id,source_bytes,unique_source_count) values('${projectId}',${bytes.byteLength},1);
    update public.projects set status='active',current_revision_id='${revisionId}',published_at=now(),lock_version=2 where id='${projectId}';
    insert into public.waveform_peak_derivatives(id,source_asset_id,owner_id,request_id,status,object_path,expected_byte_size,byte_size,sha256,format_version,algorithm_version,channels,duration_ms,sample_rate_hz,bin_count,expires_at,ready_at)
    values('${derivativeId}','${assetId}','${actor.id}','${randomUUID()}','ready','${peakObjectPath}',${peakBytes.byteLength},${peakBytes.byteLength},'${peakSha256}',1,'pcm-minmax-v1',1,2000,44100,2048,now()+interval '24 hours',now());
    update public.global_storage_usage set derived_bytes=derived_bytes+${peakBytes.byteLength} where singleton;
    commit;`;
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_jam-session",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  );
  const objectPath = `${actor.id}/${assetId}/source`;
  const { error: uploadError } = await admin.storage
    .from("source-audio")
    .upload(objectPath, bytes, {
      contentType: "audio/wav",
      upsert: true,
    });
  if (uploadError) throw uploadError;
  const { error: peakUploadError } = await admin.storage
    .from("derived-assets")
    .upload(peakObjectPath, peakBytes, {
      contentType: "application/vnd.jam-session.waveform-peaks",
      upsert: true,
    });
  if (peakUploadError) throw peakUploadError;
  const { data: stored, error: downloadError } = await admin.storage
    .from("source-audio")
    .download(objectPath);
  if (downloadError || stored.size !== bytes.byteLength)
    throw new Error(
      `Studio fixture Storage preflight failed: ${JSON.stringify({ assetId, expectedBytes: bytes.byteLength, storedBytes: stored?.size, error: downloadError?.message })}`,
    );
  const { data: storedPeak, error: peakDownloadError } = await admin.storage
    .from("derived-assets")
    .download(peakObjectPath);
  const storedPeakBytes = storedPeak
    ? Buffer.from(await storedPeak.arrayBuffer())
    : null;
  if (
    peakDownloadError ||
    !storedPeakBytes ||
    storedPeakBytes.byteLength !== peakBytes.byteLength ||
    createHash("sha256").update(storedPeakBytes).digest("hex") !== peakSha256
  )
    throw new Error(
      `Studio peak fixture Storage preflight failed: ${JSON.stringify({ assetId, expectedBytes: peakBytes.byteLength, storedBytes: storedPeakBytes?.byteLength, error: peakDownloadError?.message })}`,
    );
  return {
    projectId,
    assetId,
    databaseStatus: "ready",
    storedBytes: stored.size,
    peakBytes: Buffer.from(peakBytes),
    sourceBytes: bytes,
  };
}

async function startFixtureDelivery(sourceBytes: Buffer, peakBytes: Buffer) {
  const server = createServer((request, response) => {
    const send = (body: Buffer, contentType: string) => {
      response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "Content-Length": body.byteLength,
        "Content-Type": contentType,
      });
      response.end(body);
    };
    if (request.url === "/peaks") {
      send(peakBytes, "application/vnd.jam-session.waveform-peaks");
      return;
    }
    if (request.url === "/source") {
      setTimeout(() => send(sourceBytes, "audio/wav"), 1_500);
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("The studio fixture delivery server did not bind.");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    sourceUrl: `${baseUrl}/source`,
    peakUrl: `${baseUrl}/peaks`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

type NetworkEvent = {
  event: "request" | "response" | "requestfailed";
  method: string;
  path: string;
  status?: number;
  error?: string;
};

function recordNetworkEvent(
  events: NetworkEvent[],
  event: NetworkEvent["event"],
  rawUrl: string,
  details: Omit<NetworkEvent, "event" | "path">,
) {
  const { pathname } = new URL(rawUrl);
  if (
    !pathname.endsWith("/audio-sources") &&
    !pathname.startsWith("/storage/v1/object/")
  )
    return;
  events.push({ event, path: pathname, ...details });
}
