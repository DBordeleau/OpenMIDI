import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const CONFIRMATION = "RELEASE-02-BETA-v1";
const FIXTURE_PATH = fileURLToPath(
  new URL(
    "../src/features/release/release-02-beta-content.json",
    import.meta.url,
  ),
);

function parseArgs(argv) {
  const args = { execute: false, actorId: "", confirmation: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--execute") args.execute = true;
    else if (value === "--actor-id") args.actorId = argv[++index] ?? "";
    else if (value === "--confirm") args.confirmation = argv[++index] ?? "";
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(args.actorId)) {
    throw new Error(
      "Pass the explicitly confirmed curator with --actor-id <uuid>.",
    );
  }
  if (args.execute && args.confirmation !== CONFIRMATION) {
    throw new Error(
      `Execution requires --confirm ${CONFIRMATION}. Run without --execute for a no-mutation report.`,
    );
  }
  return args;
}

function serializePostgresJsonb(value) {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serializePostgresJsonb).join(", ")}]`;
  }
  const entries = Object.entries(value).sort(
    ([left], [right]) =>
      left.length - right.length || (left < right ? -1 : left > right ? 1 : 0),
  );
  return `{${entries
    .map(
      ([key, item]) =>
        `${JSON.stringify(key)}: ${serializePostgresJsonb(item)}`,
    )
    .join(", ")}}`;
}

function sha256Jsonb(value) {
  return createHash("sha256")
    .update(serializePostgresJsonb(value))
    .digest("hex");
}

async function loadFixture() {
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
  if (fixture.fixtureVersion !== 1)
    throw new Error("Unsupported beta fixture version.");
  for (const pattern of fixture.patterns) {
    const actual = sha256Jsonb({
      ppq: 480,
      durationTicks: pattern.durationTicks,
      notes: pattern.notes,
    });
    if (actual !== pattern.expectedContentSha256) {
      throw new Error(`Reviewed hash drift for pattern ${pattern.key}.`);
    }
  }
  if (
    sha256Jsonb(fixture.challenge.constraints) !==
    fixture.challenge.expectedConstraintsSha256
  ) {
    throw new Error("Reviewed challenge constraint hash drift.");
  }
  return fixture;
}

function requiredEnvironment() {
  const url =
    process.env.OPENMIDI_SEED_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "";
  const publishableKey =
    process.env.OPENMIDI_SEED_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  const accessToken = process.env.OPENMIDI_SEED_ACCESS_TOKEN ?? "";
  if (!url || !publishableKey || !accessToken) {
    throw new Error(
      "Set OPENMIDI_SEED_SUPABASE_URL, OPENMIDI_SEED_PUBLISHABLE_KEY, and OPENMIDI_SEED_ACCESS_TOKEN. Nothing was changed.",
    );
  }
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "127.0.0.1") {
    throw new Error(
      "The seed target must use HTTPS or the local 127.0.0.1 stack.",
    );
  }
  return { url, publishableKey, accessToken, target: parsedUrl.origin };
}

function createActorClient({ url, publishableKey, accessToken }) {
  return createClient(url, publishableKey, {
    accessToken: async () => accessToken,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function createAuthClient({ url, publishableKey }) {
  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function equalArray(left, right) {
  return (
    JSON.stringify([...(left ?? [])].sort()) ===
    JSON.stringify([...right].sort())
  );
}

async function requireActorAndAdmin(db, authClient, actorId, accessToken) {
  const { data: userData, error: userError } =
    await authClient.auth.getUser(accessToken);
  if (userError || !userData.user || userData.user.id !== actorId) {
    throw new Error(
      "The access token does not belong to the explicitly confirmed actor.",
    );
  }
  const { data: profile, error: profileError } = await db
    .from("public_profiles")
    .select("id,credit_name")
    .eq("id", actorId)
    .maybeSingle();
  if (profileError || !profile) {
    throw new Error(
      "The confirmed actor does not have an active visible profile.",
    );
  }
  const { data: challenges, error: adminError } = await db.rpc(
    "list_admin_challenges",
  );
  if (adminError || !Array.isArray(challenges)) {
    throw new Error(
      "The confirmed actor is not an active administrator/curator.",
    );
  }
  return { profile, challenges };
}

async function readExisting(db, actorId, fixture, challenges) {
  const projectRequests = fixture.projects.map(({ requestId }) => requestId);
  const patternRequests = fixture.patterns.map(({ requestId }) => requestId);
  const { data: projects, error: projectsError } = await db
    .from("projects")
    .select(
      "id,create_request_id,title,description,bpm,musical_key,time_signature_numerator,time_signature_denominator,license_code,visibility,status,current_revision_id,lock_version,project_genres(genre_id,is_primary),project_tags(tag_id)",
    )
    .eq("owner_id", actorId)
    .in("create_request_id", projectRequests);
  const { data: patterns, error: patternsError } = await db
    .from("midi_patterns")
    .select("id,create_request_id,name")
    .eq("owner_id", actorId)
    .in("create_request_id", patternRequests);
  if (projectsError || patternsError)
    throw new Error("Seed preflight reads failed.");

  const projectIds = (projects ?? []).map(({ id }) => id);
  const patternIds = (patterns ?? []).map(({ id }) => id);
  const [
    { data: workspaces, error: workspacesError },
    { data: versions, error: versionsError },
    { data: ownedListings, error: listingsError },
  ] = await Promise.all([
    projectIds.length
      ? db
          .from("workspaces")
          .select(
            "id,project_id,lock_version,base_revision_id,last_manifest_request_id,last_manifest_expected_lock_version,manifest,manifest_sha256,status",
          )
          .eq("owner_id", actorId)
          .in("project_id", projectIds)
      : Promise.resolve({ data: [], error: null }),
    patternIds.length
      ? db
          .from("midi_pattern_versions")
          .select(
            "id,midi_pattern_id,create_request_id,version_number,content_sha256,reuse_license_code",
          )
          .in("midi_pattern_id", patternIds)
      : Promise.resolve({ data: [], error: null }),
    patternIds.length
      ? db.rpc("list_owned_midi_library_versions", { p_limit: 100 })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (workspacesError || versionsError || listingsError) {
    const failed = [
      ["workspaces", workspacesError],
      ["pattern versions", versionsError],
      ["library listings", listingsError],
    ]
      .filter(([, error]) => error)
      .map(([name, error]) => `${name}: ${error.code}`)
      .join(", ");
    throw new Error(`Seed relationship preflight reads failed (${failed}).`);
  }
  const activeOwnedListings = (ownedListings ?? []).filter(
    ({ active_listing_id, pattern_id }) =>
      active_listing_id && patternIds.includes(pattern_id),
  );
  const detailResponses = await Promise.all(
    activeOwnedListings.map(({ active_listing_id }) =>
      db.rpc("get_public_midi_library_listing", {
        p_listing_id: active_listing_id,
      }),
    ),
  );
  if (detailResponses.some(({ data, error }) => error || !data)) {
    throw new Error(
      "An active owned seed listing is hidden or unavailable. Resolve it before importing.",
    );
  }
  const listings = detailResponses.map(({ data }) => ({
    id: data.listing.listingId,
    midi_pattern_id: data.listing.midiPatternId,
    midi_pattern_version_id: data.listing.midiPatternVersionId,
    title: data.listing.title,
    description: data.listing.description,
    reuse_mode: data.listing.reuseMode,
    rights_basis: data.listing.rightsBasis,
    category_code: data.listing.category.code,
    suggested_preset_id: data.listing.preset.id,
    unlisted_at: null,
    moderation_hidden_at: null,
  }));
  return {
    projects: projects ?? [],
    workspaces: workspaces ?? [],
    patterns: patterns ?? [],
    versions: versions ?? [],
    listings: listings ?? [],
    challenges,
  };
}

function decide(existing, fixture) {
  const decisions = [];
  const patternVersionIds = new Map();

  for (const pattern of fixture.patterns) {
    const row = existing.patterns.find(
      ({ create_request_id }) => create_request_id === pattern.requestId,
    );
    if (!row) {
      decisions.push({
        kind: "pattern",
        key: pattern.key,
        decision: "create",
        reason: "request id is unused",
        hash: pattern.expectedContentSha256,
        rights: pattern.reuseMode,
      });
      continue;
    }
    const version = existing.versions.find(
      ({ midi_pattern_id, create_request_id }) =>
        midi_pattern_id === row.id &&
        create_request_id === pattern.versionRequestId,
    );
    const listing = existing.listings.find(
      ({ midi_pattern_id, unlisted_at }) =>
        midi_pattern_id === row.id && unlisted_at === null,
    );
    const expectedLicense = pattern.reuseMode === "commercial_reuse";
    if (
      row.name !== pattern.name ||
      (version &&
        (version.content_sha256 !== pattern.expectedContentSha256 ||
          (version.reuse_license_code !== null) !== expectedLicense)) ||
      (listing &&
        (listing.midi_pattern_version_id !== version?.id ||
          listing.reuse_mode !== pattern.reuseMode ||
          listing.rights_basis !== "original" ||
          listing.category_code !== pattern.categoryCode ||
          listing.suggested_preset_id !== pattern.suggestedPresetId ||
          listing.description !== pattern.description ||
          listing.moderation_hidden_at !== null))
    ) {
      decisions.push({
        kind: "pattern",
        key: pattern.key,
        decision: "conflict",
        reason:
          "the deterministic request id or active listing has different content",
        hash: pattern.expectedContentSha256,
        rights: pattern.reuseMode,
      });
      continue;
    }
    if (version) patternVersionIds.set(pattern.key, version.id);
    decisions.push({
      kind: "pattern",
      key: pattern.key,
      decision: version && listing ? "reuse" : "create",
      reason:
        version && listing
          ? "exact pattern version and listing already exist"
          : "resume an incomplete exact import",
      hash: pattern.expectedContentSha256,
      rights: pattern.reuseMode,
    });
  }

  for (const project of fixture.projects) {
    const row = existing.projects.find(
      ({ create_request_id }) => create_request_id === project.requestId,
    );
    if (!row) {
      decisions.push({
        kind: "project",
        key: project.key,
        decision: "create",
        reason: "request id is unused",
        license: project.licenseCode,
      });
      continue;
    }
    const workspace = existing.workspaces.find(
      ({ project_id, status }) => project_id === row.id && status === "active",
    );
    const genreIds = row.project_genres.map(({ genre_id }) => genre_id);
    const primaryGenre = row.project_genres.find(
      ({ is_primary }) => is_primary,
    )?.genre_id;
    const tagIds = row.project_tags.map(({ tag_id }) => tag_id);
    const expectedPatternIds = project.tracks.map(({ patternKey }) =>
      patternVersionIds.get(patternKey),
    );
    const manifestPatternIds = workspace?.manifest?.tracks?.flatMap((track) =>
      track.clips.map(({ midiPatternVersionId }) => midiPatternVersionId),
    );
    if (
      row.title !== project.title ||
      (row.description ?? "") !== project.description ||
      Number(row.bpm) !== project.tempoBpm ||
      row.musical_key !== project.musicalKey ||
      row.time_signature_numerator !== project.timeSignature.numerator ||
      row.time_signature_denominator !== project.timeSignature.denominator ||
      row.license_code !== project.licenseCode ||
      !equalArray(genreIds, project.genreIds) ||
      primaryGenre !== project.primaryGenreId ||
      !equalArray(tagIds, project.tagIds) ||
      !workspace ||
      (row.current_revision_id &&
        (!equalArray(manifestPatternIds, expectedPatternIds) ||
          workspace.manifest.durationTicks !== project.durationTicks))
    ) {
      decisions.push({
        kind: "project",
        key: project.key,
        decision: "conflict",
        reason:
          "the deterministic request id has different metadata or manifest",
        license: project.licenseCode,
      });
      continue;
    }
    decisions.push({
      kind: "project",
      key: project.key,
      decision:
        row.current_revision_id && row.visibility === "public"
          ? "reuse"
          : "create",
      reason:
        row.current_revision_id && row.visibility === "public"
          ? "exact public project already exists"
          : "resume an incomplete exact import",
      license: project.licenseCode,
    });
  }

  const challenge = fixture.challenge;
  const row = existing.challenges.find(({ slug }) => slug === challenge.slug);
  if (!row) {
    decisions.push({
      kind: "challenge",
      key: challenge.slug,
      decision: "create",
      reason: "slug is unused",
      hash: challenge.expectedConstraintsSha256,
    });
  } else if (
    row.title !== challenge.title ||
    row.constraintsSha256 !== challenge.expectedConstraintsSha256 ||
    !["draft", "published"].includes(row.state)
  ) {
    decisions.push({
      kind: "challenge",
      key: challenge.slug,
      decision: "conflict",
      reason: "the challenge slug has different immutable content or lifecycle",
      hash: challenge.expectedConstraintsSha256,
    });
  } else {
    decisions.push({
      kind: "challenge",
      key: challenge.slug,
      decision: row.state === "published" ? "reuse" : "create",
      reason:
        row.state === "published"
          ? "exact published challenge already exists"
          : "publish the exact existing draft",
      hash: challenge.expectedConstraintsSha256,
    });
  }
  return decisions;
}

function one(data, error, label) {
  if (error) throw new Error(`${label}: ${error.message}`);
  const value = Array.isArray(data) ? data[0] : data;
  if (!value) throw new Error(`${label}: empty response`);
  return value;
}

function buildManifest(project, projectId, workspaceId, versionsByKey) {
  return {
    manifestVersion: 3,
    engine: "openmidi-midi",
    engineVersion: "openmidi-midi-3_tone-15.1.22_presets-1",
    projectId,
    workspaceId,
    tempoBpm: project.tempoBpm,
    timeSignature: project.timeSignature,
    musicalKey: project.musicalKey,
    ppq: 480,
    durationTicks: project.durationTicks,
    tracks: project.tracks.map((track, sortOrder) => ({
      trackId: track.trackId,
      sortOrder,
      name: track.name,
      presetId: track.presetId,
      presetVersion: 1,
      gainDb: track.gainDb,
      pan: track.pan,
      muted: false,
      soloed: false,
      clips: [
        {
          clipId: track.clipId,
          midiPatternVersionId: versionsByKey.get(track.patternKey),
          startTick: 0,
          durationTicks: project.durationTicks,
          sourceStartTick: 0,
          loop: true,
        },
      ],
    })),
  };
}

async function executeImport(db, fixture, decisions, existing) {
  const decisionFor = (kind, key) =>
    decisions.find((item) => item.kind === kind && item.key === key)?.decision;
  const versionsByKey = new Map();
  for (const pattern of fixture.patterns) {
    if (decisionFor("pattern", pattern.key) === "reuse") {
      const parent = existing.patterns.find(
        ({ create_request_id }) => create_request_id === pattern.requestId,
      );
      const version = existing.versions.find(
        ({ midi_pattern_id, create_request_id }) =>
          midi_pattern_id === parent.id &&
          create_request_id === pattern.versionRequestId,
      );
      versionsByKey.set(pattern.key, version.id);
      continue;
    }
    const patternResponse = await db.rpc("create_midi_pattern_v3", {
      p_request_id: pattern.requestId,
      p_name: pattern.name,
    });
    const createdPattern = one(
      patternResponse.data,
      patternResponse.error,
      `create pattern ${pattern.key}`,
    );
    const versionResponse = await db.rpc("create_midi_pattern_version_v3", {
      p_pattern_id: createdPattern.pattern_id,
      p_request_id: pattern.versionRequestId,
      p_expected_version_number: 1,
      p_ppq: 480,
      p_duration_ticks: pattern.durationTicks,
      p_notes: pattern.notes,
      p_publish_for_reuse: pattern.reuseMode === "commercial_reuse",
      p_rights_attestation_version:
        pattern.reuseMode === "commercial_reuse"
          ? "cc-by-4.0-attestation-v1"
          : undefined,
    });
    const version = one(
      versionResponse.data,
      versionResponse.error,
      `create version ${pattern.key}`,
    );
    if (version.content_sha256 !== pattern.expectedContentSha256) {
      throw new Error(`Database hash mismatch for ${pattern.key}.`);
    }
    versionsByKey.set(pattern.key, version.pattern_version_id);
    const listingResponse = await db.rpc("list_midi_library_pattern_version", {
      p_pattern_version_id: version.pattern_version_id,
      p_request_id: pattern.listingRequestId,
      p_reuse_mode: pattern.reuseMode,
      p_rights_basis: "original",
      p_attestation_version:
        pattern.reuseMode === "commercial_reuse"
          ? "midi-library-commercial-attestation-v1"
          : "midi-library-reference-display-attestation-v1",
      p_description: pattern.description,
      p_supporting_source_url: null,
      p_supporting_source_terms: null,
      p_public_domain_rationale: null,
      p_category_code: pattern.categoryCode,
      p_suggested_preset_id: pattern.suggestedPresetId,
      p_suggested_preset_version: 1,
      p_tags: pattern.tags,
      p_external_credits: [],
    });
    one(
      listingResponse.data,
      listingResponse.error,
      `list pattern ${pattern.key}`,
    );
  }

  for (const project of fixture.projects) {
    if (decisionFor("project", project.key) === "reuse") continue;
    const createResponse = await db.rpc("create_midi_project_workspace_v3", {
      p_request_id: project.requestId,
      p_title: project.title,
      p_description: project.description,
      p_bpm: project.tempoBpm,
      p_musical_key: project.musicalKey,
      p_time_signature_numerator: project.timeSignature.numerator,
      p_time_signature_denominator: project.timeSignature.denominator,
      p_license_code: project.licenseCode,
      p_genre_ids: project.genreIds,
      p_primary_genre_id: project.primaryGenreId,
      p_tag_ids: project.tagIds,
    });
    const created = one(
      createResponse.data,
      createResponse.error,
      `create project ${project.key}`,
    );
    const { data: workspace, error: workspaceError } = await db
      .from("workspaces")
      .select(
        "id,lock_version,base_revision_id,last_manifest_request_id,last_manifest_expected_lock_version",
      )
      .eq("id", created.workspace_id)
      .single();
    if (workspaceError || !workspace)
      throw new Error(`read workspace ${project.key}`);
    const manifest = buildManifest(
      project,
      created.project_id,
      created.workspace_id,
      versionsByKey,
    );
    const saveExpectedLock =
      workspace.last_manifest_request_id === project.saveRequestId
        ? workspace.last_manifest_expected_lock_version
        : workspace.lock_version;
    const saveResponse = await db.rpc("save_midi_workspace_v3", {
      p_workspace_id: workspace.id,
      p_request_id: project.saveRequestId,
      p_expected_lock_version: saveExpectedLock,
      p_manifest: manifest,
    });
    const saved = one(
      saveResponse.data,
      saveResponse.error,
      `save project ${project.key}`,
    );
    const publishResponse = await db.rpc("publish_midi_workspace_revision_v3", {
      p_workspace_id: workspace.id,
      p_request_id: project.publishRequestId,
      p_expected_workspace_lock_version: saved.lock_version,
      p_expected_base_revision_id: workspace.base_revision_id,
      p_message: project.revisionMessage,
    });
    one(
      publishResponse.data,
      publishResponse.error,
      `publish project ${project.key}`,
    );
    const { data: freshProject, error: freshProjectError } = await db
      .from("projects")
      .select("lock_version,visibility")
      .eq("id", created.project_id)
      .single();
    if (freshProjectError || !freshProject)
      throw new Error(`read project ${project.key}`);
    if (freshProject.visibility !== "public") {
      const visibilityResponse = await db.rpc("set_project_visibility", {
        p_project_id: created.project_id,
        p_expected_lock_version: freshProject.lock_version,
        p_visibility: "public",
      });
      one(
        visibilityResponse.data,
        visibilityResponse.error,
        `publish visibility ${project.key}`,
      );
    }
  }

  const challenge = fixture.challenge;
  if (decisionFor("challenge", challenge.slug) !== "reuse") {
    const createResponse = await db.rpc("create_challenge_draft", {
      p_request_id: challenge.requestId,
      p_slug: challenge.slug,
      p_version: {
        title: challenge.title,
        prompt: challenge.prompt,
        description: challenge.description,
        eligibilityTerms: challenge.eligibilityTerms,
        presentationCode: challenge.presentationCode,
        opensAt: challenge.opensAt,
        submissionsCloseAt: challenge.submissionsCloseAt,
        votingOpensAt: challenge.votingOpensAt,
        votingClosesAt: challenge.votingClosesAt,
        resultsExpectedAt: challenge.resultsExpectedAt,
        judgingMode: challenge.judgingMode,
        officialPlacementCount: challenge.officialPlacementCount,
        starterProjectId: null,
        starterRevisionId: null,
        constraints: challenge.constraints,
      },
      p_judges: challenge.judges,
    });
    const created = one(
      createResponse.data,
      createResponse.error,
      "create challenge",
    );
    const publishResponse = await db.rpc("publish_challenge", {
      p_challenge_id: created.challengeId,
      p_request_id: challenge.publishRequestId,
      p_expected_lifecycle_version: created.lifecycleVersion,
      p_expected_current_version_id: created.versionId,
    });
    one(publishResponse.data, publishResponse.error, "publish challenge");
  }
}

function printReport({ args, environment, actor, fixture, decisions }) {
  console.log(`RELEASE-02 beta seed ${args.execute ? "execution" : "dry run"}`);
  console.log(`Target: ${environment.target}`);
  console.log(`Owner: ${actor.profile.credit_name} (${args.actorId})`);
  console.log(
    `Fixture: v${fixture.fixtureVersion}; ${fixture.projects.length} projects; ${fixture.patterns.length} library patterns; 1 challenge`,
  );
  for (const item of decisions) {
    const details = [item.license, item.rights, item.hash]
      .filter(Boolean)
      .join(" · ");
    console.log(
      `${item.decision.toUpperCase()} ${item.kind}:${item.key}${details ? ` · ${details}` : ""} · ${item.reason}`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixture = await loadFixture();
  const environment = requiredEnvironment();
  const db = createActorClient(environment);
  const authClient = createAuthClient(environment);
  const actor = await requireActorAndAdmin(
    db,
    authClient,
    args.actorId,
    environment.accessToken,
  );
  const existing = await readExisting(
    db,
    args.actorId,
    fixture,
    actor.challenges,
  );
  const decisions = decide(existing, fixture);
  printReport({ args, environment, actor, fixture, decisions });
  if (decisions.some(({ decision }) => decision === "conflict")) {
    throw new Error("Conflicts detected. Nothing was changed.");
  }
  if (!args.execute) {
    console.log(
      `No mutation performed. To execute this exact fixture, add --execute --confirm ${CONFIRMATION}.`,
    );
    return;
  }
  await executeImport(db, fixture, decisions, existing);
  console.log(
    "Import complete. Run the dry run again; every item must report REUSE.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed import failed.");
  process.exitCode = 1;
});
