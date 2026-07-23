CREATE TABLE "private"."stale_owner_workspace_resolutions" (
  "actor_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "source_project_id" uuid NOT NULL,
  "source_workspace_id" uuid NOT NULL,
  "source_base_revision_id" uuid NOT NULL,
  "observed_current_revision_id" uuid NOT NULL,
  "expected_workspace_lock_version" integer NOT NULL,
  "resolution" text NOT NULL,
  "normalized_fork_title" text,
  "target_project_id" uuid NOT NULL,
  "target_workspace_id" uuid NOT NULL,
  "target_base_revision_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT "stale_owner_workspace_resolutions_pkey"
    PRIMARY KEY ("actor_id", "request_id"),
  CONSTRAINT "stale_owner_workspace_resolutions_lock_version_check"
    CHECK ("expected_workspace_lock_version" > 0),
  CONSTRAINT "stale_owner_workspace_resolutions_resolution_check"
    CHECK ("resolution" IN ('restart_latest', 'preserve_as_fork')),
  CONSTRAINT "stale_owner_workspace_resolutions_fork_title_check"
    CHECK (
      (
        "resolution" = 'restart_latest'
        AND "normalized_fork_title" IS NULL
      )
      OR (
        "resolution" = 'preserve_as_fork'
        AND "normalized_fork_title" = btrim("normalized_fork_title")
        AND char_length("normalized_fork_title") BETWEEN 1 AND 120
      )
    ),
  CONSTRAINT "stale_owner_workspace_resolutions_actor_fkey"
    FOREIGN KEY ("actor_id")
    REFERENCES "public"."profiles" ("id")
    ON DELETE RESTRICT,
  CONSTRAINT "stale_owner_workspace_resolutions_source_workspace_fkey"
    FOREIGN KEY ("source_workspace_id", "source_project_id", "actor_id")
    REFERENCES "public"."workspaces" ("id", "project_id", "owner_id")
    ON DELETE RESTRICT,
  CONSTRAINT "stale_owner_workspace_resolutions_source_base_fkey"
    FOREIGN KEY ("source_project_id", "source_base_revision_id")
    REFERENCES "public"."project_revisions" ("project_id", "id")
    ON DELETE RESTRICT,
  CONSTRAINT "stale_owner_workspace_resolutions_observed_current_fkey"
    FOREIGN KEY ("source_project_id", "observed_current_revision_id")
    REFERENCES "public"."project_revisions" ("project_id", "id")
    ON DELETE RESTRICT,
  CONSTRAINT "stale_owner_workspace_resolutions_target_workspace_fkey"
    FOREIGN KEY ("target_workspace_id", "target_project_id", "actor_id")
    REFERENCES "public"."workspaces" ("id", "project_id", "owner_id")
    ON DELETE RESTRICT,
  CONSTRAINT "stale_owner_workspace_resolutions_target_base_fkey"
    FOREIGN KEY ("target_project_id", "target_base_revision_id")
    REFERENCES "public"."project_revisions" ("project_id", "id")
    ON DELETE RESTRICT
);

ALTER TABLE "private"."stale_owner_workspace_resolutions" OWNER TO "postgres";

COMMENT ON TABLE "private"."stale_owner_workspace_resolutions" IS
  'Private idempotency evidence for atomic stale owner workspace restart and recovered-fork commands.';

COMMENT ON COLUMN "private"."stale_owner_workspace_resolutions"."normalized_fork_title" IS
  'Normalized recovery-fork title retained to distinguish exact command retries.';

CREATE INDEX "stale_owner_workspace_resolutions_source_workspace_idx"
  ON "private"."stale_owner_workspace_resolutions" ("source_workspace_id", "created_at" DESC);

CREATE INDEX "stale_owner_workspace_resolutions_target_project_idx"
  ON "private"."stale_owner_workspace_resolutions" ("target_project_id", "created_at" DESC);

ALTER TABLE "private"."stale_owner_workspace_resolutions" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "private"."stale_owner_workspace_resolutions" FROM PUBLIC;
REVOKE ALL ON TABLE "private"."stale_owner_workspace_resolutions" FROM "anon";
REVOKE ALL ON TABLE "private"."stale_owner_workspace_resolutions" FROM "authenticated";

CREATE FUNCTION "public"."resolve_stale_owner_workspace_v3"(
  "p_workspace_id" uuid,
  "p_request_id" uuid,
  "p_expected_workspace_lock_version" integer,
  "p_expected_base_revision_id" uuid,
  "p_expected_current_revision_id" uuid,
  "p_resolution" text,
  "p_fork_title" text DEFAULT NULL
) RETURNS TABLE(
  "resolution" text,
  "source_project_id" uuid,
  "source_workspace_id" uuid,
  "target_project_id" uuid,
  "target_workspace_id" uuid,
  "target_base_revision_id" uuid,
  "target_workspace_lock_version" integer,
  "created_at" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_receipt private.stale_owner_workspace_resolutions%ROWTYPE;
  v_source_project_id uuid;
  v_project public.projects%ROWTYPE;
  v_workspace public.workspaces%ROWTYPE;
  v_base_revision public.project_revisions%ROWTYPE;
  v_current_revision public.project_revisions%ROWTYPE;
  v_base_arrangement public.arrangement_versions%ROWTYPE;
  v_current_arrangement public.arrangement_versions%ROWTYPE;
  v_target_project public.projects%ROWTYPE;
  v_target_arrangement public.arrangement_versions%ROWTYPE;
  v_target_revision public.project_revisions%ROWTYPE;
  v_target_workspace public.workspaces%ROWTYPE;
  v_target_workspace_id uuid := gen_random_uuid();
  v_arrangement_manifest jsonb;
  v_workspace_manifest jsonb;
  v_arrangement_hash text;
  v_workspace_hash text;
  v_fork_title text := CASE
    WHEN p_fork_title IS NULL THEN NULL
    ELSE btrim(p_fork_title)
  END;
BEGIN
  IF v_actor IS NULL THEN
    RAISE SQLSTATE 'PT401' USING MESSAGE = 'draft_resolution_unauthenticated';
  END IF;
  IF NOT (SELECT private.is_active_project_actor()) THEN
    RAISE SQLSTATE 'PT403' USING MESSAGE = 'draft_resolution_actor_ineligible';
  END IF;
  IF p_workspace_id IS NULL
    OR p_request_id IS NULL
    OR p_expected_workspace_lock_version IS NULL
    OR p_expected_workspace_lock_version <= 0
    OR p_expected_base_revision_id IS NULL
    OR p_expected_current_revision_id IS NULL
    OR p_resolution IS NULL
    OR p_resolution NOT IN ('restart_latest', 'preserve_as_fork')
    OR (
      p_resolution = 'restart_latest'
      AND p_fork_title IS NOT NULL
    )
    OR (
      p_resolution = 'preserve_as_fork'
      AND (
        v_fork_title IS NULL
        OR char_length(v_fork_title) NOT BETWEEN 1 AND 120
      )
    )
  THEN
    RAISE SQLSTATE '22023' USING MESSAGE = 'draft_resolution_invalid_input';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'stale-owner-workspace:' || v_actor::text || ':' || p_request_id::text,
      0
    )
  );

  SELECT *
  INTO v_receipt
  FROM private.stale_owner_workspace_resolutions r
  WHERE r.actor_id = v_actor
    AND r.request_id = p_request_id;

  IF FOUND THEN
    IF v_receipt.source_workspace_id <> p_workspace_id
      OR v_receipt.source_base_revision_id <> p_expected_base_revision_id
      OR v_receipt.observed_current_revision_id <> p_expected_current_revision_id
      OR v_receipt.expected_workspace_lock_version <> p_expected_workspace_lock_version
      OR v_receipt.resolution <> p_resolution
      OR v_receipt.normalized_fork_title IS DISTINCT FROM v_fork_title
    THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE = 'draft_resolution_request_conflict';
    END IF;

    RETURN QUERY
    SELECT
      v_receipt.resolution,
      v_receipt.source_project_id,
      v_receipt.source_workspace_id,
      v_receipt.target_project_id,
      v_receipt.target_workspace_id,
      v_receipt.target_base_revision_id,
      target.lock_version,
      v_receipt.created_at
    FROM public.workspaces target
    WHERE target.id = v_receipt.target_workspace_id
      AND target.project_id = v_receipt.target_project_id
      AND target.owner_id = v_actor;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.owner_id = v_actor
      AND p.create_request_id = p_request_id
  ) OR EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.owner_id = v_actor
      AND w.create_request_id = p_request_id
  ) THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'draft_resolution_request_conflict';
  END IF;

  SELECT w.project_id
  INTO v_source_project_id
  FROM public.workspaces w
  WHERE w.id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE SQLSTATE 'PT404' USING MESSAGE = 'draft_resolution_workspace_not_found';
  END IF;

  SELECT *
  INTO v_project
  FROM public.projects p
  WHERE p.id = v_source_project_id
    AND p.owner_id = v_actor
    AND p.status = 'active'
    AND p.visibility IN ('private', 'public')
    AND p.deleted_at IS NULL
    AND p.purged_at IS NULL
    AND p.moderation_state = 'visible'
    AND p.compatibility = 'midi'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE SQLSTATE 'PT404' USING MESSAGE = 'draft_resolution_workspace_not_found';
  END IF;
  IF v_project.current_revision_id IS DISTINCT FROM p_expected_current_revision_id THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'draft_resolution_project_changed';
  END IF;

  SELECT *
  INTO v_workspace
  FROM public.workspaces w
  WHERE w.id = p_workspace_id
    AND w.project_id = v_project.id
    AND w.owner_id = v_actor
    AND w.status = 'active'
    AND w.contribution_id IS NULL
    AND w.manifest_version = 3
    AND w.engine = 'openmidi-midi'
    AND w.engine_version = 'openmidi-midi-3_tone-15.1.22_presets-1'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE SQLSTATE 'PT404' USING MESSAGE = 'draft_resolution_workspace_not_found';
  END IF;
  IF v_workspace.lock_version <> p_expected_workspace_lock_version
    OR v_workspace.base_revision_id IS DISTINCT FROM p_expected_base_revision_id
  THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'draft_resolution_workspace_changed';
  END IF;
  IF v_workspace.base_revision_id = v_project.current_revision_id THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'draft_resolution_not_stale';
  END IF;

  SELECT *
  INTO v_base_revision
  FROM public.project_revisions r
  WHERE r.id = v_workspace.base_revision_id
    AND r.project_id = v_project.id
    AND r.manifest_version = 3
    AND r.engine = 'openmidi-midi'
    AND r.engine_version = 'openmidi-midi-3_tone-15.1.22_presets-1'
    AND r.arrangement_version_id IS NOT NULL;

  SELECT *
  INTO v_current_revision
  FROM public.project_revisions r
  WHERE r.id = v_project.current_revision_id
    AND r.project_id = v_project.id
    AND r.manifest_version = 3
    AND r.engine = 'openmidi-midi'
    AND r.engine_version = 'openmidi-midi-3_tone-15.1.22_presets-1'
    AND r.arrangement_version_id IS NOT NULL;

  IF v_base_revision.id IS NULL OR v_current_revision.id IS NULL THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'draft_resolution_project_changed';
  END IF;

  SELECT *
  INTO v_base_arrangement
  FROM public.arrangement_versions a
  WHERE a.id = v_base_revision.arrangement_version_id
    AND a.project_id = v_project.id;

  SELECT *
  INTO v_current_arrangement
  FROM public.arrangement_versions a
  WHERE a.id = v_current_revision.arrangement_version_id
    AND a.project_id = v_project.id;

  IF v_base_arrangement.id IS NULL
    OR v_current_arrangement.id IS NULL
    OR private.canonical_manifest_v3(v_base_revision.manifest, v_project.id, NULL)
      <> v_base_revision.manifest
    OR private.canonical_manifest_v3(v_current_revision.manifest, v_project.id, NULL)
      <> v_current_revision.manifest
    OR private.canonical_manifest_v3(v_workspace.manifest, v_project.id, v_workspace.id)
      <> v_workspace.manifest
    OR encode(
      extensions.digest(convert_to(v_base_revision.manifest::text, 'UTF8'), 'sha256'),
      'hex'
    ) <> v_base_revision.manifest_sha256
    OR encode(
      extensions.digest(convert_to(v_current_revision.manifest::text, 'UTF8'), 'sha256'),
      'hex'
    ) <> v_current_revision.manifest_sha256
    OR encode(
      extensions.digest(convert_to(v_workspace.manifest::text, 'UTF8'), 'sha256'),
      'hex'
    ) <> v_workspace.manifest_sha256
  THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'draft_resolution_project_changed';
  END IF;

  IF p_resolution = 'restart_latest' THEN
    v_workspace_manifest :=
      v_current_revision.manifest
      || jsonb_build_object('workspaceId', v_target_workspace_id);
    v_workspace_manifest := private.canonical_manifest_v3(
      v_workspace_manifest,
      v_project.id,
      v_target_workspace_id
    );
    v_workspace_hash := encode(
      extensions.digest(convert_to(v_workspace_manifest::text, 'UTF8'), 'sha256'),
      'hex'
    );

    UPDATE public.workspaces
    SET status = 'archived',
      updated_at = statement_timestamp()
    WHERE id = v_workspace.id;

    INSERT INTO public.workspaces (
      id,
      project_id,
      owner_id,
      create_request_id,
      base_revision_id,
      manifest,
      manifest_version,
      engine,
      engine_version,
      manifest_sha256
    ) VALUES (
      v_target_workspace_id,
      v_project.id,
      v_actor,
      p_request_id,
      v_current_revision.id,
      v_workspace_manifest,
      3,
      'openmidi-midi',
      'openmidi-midi-3_tone-15.1.22_presets-1',
      v_workspace_hash
    )
    RETURNING * INTO v_target_workspace;

    PERFORM private.replace_workspace_projection_v3(
      v_target_workspace.id,
      v_workspace_manifest
    );

    INSERT INTO private.workspace_snapshots (
      workspace_id,
      project_id,
      owner_id,
      request_id,
      lock_version,
      manifest,
      manifest_sha256
    ) VALUES (
      v_target_workspace.id,
      v_target_workspace.project_id,
      v_actor,
      p_request_id,
      v_target_workspace.lock_version,
      v_workspace_manifest,
      v_workspace_hash
    );

    v_target_project := v_project;
    v_target_revision := v_current_revision;
  ELSE
    INSERT INTO public.projects (
      owner_id,
      create_request_id,
      title,
      description,
      bpm,
      musical_key,
      time_signature_numerator,
      time_signature_denominator,
      license_code,
      compatibility,
      source_project_id,
      source_revision_id,
      rights_attestation_version
    ) VALUES (
      v_actor,
      p_request_id,
      v_fork_title,
      v_project.description,
      v_base_arrangement.tempo_bpm,
      v_base_arrangement.musical_key,
      v_base_arrangement.time_signature_numerator,
      v_base_arrangement.time_signature_denominator,
      v_project.license_code,
      'midi',
      v_project.id,
      v_base_revision.id,
      v_project.rights_attestation_version
    )
    RETURNING * INTO v_target_project;

    INSERT INTO public.project_members (
      project_id,
      user_id,
      role,
      created_by
    ) VALUES (
      v_target_project.id,
      v_actor,
      'owner',
      v_actor
    );

    INSERT INTO public.project_genres (project_id, genre_id, is_primary)
    SELECT v_target_project.id, source.genre_id, source.is_primary
    FROM public.project_genres source
    WHERE source.project_id = v_project.id;

    INSERT INTO public.project_tags (project_id, tag_id)
    SELECT v_target_project.id, source.tag_id
    FROM public.project_tags source
    WHERE source.project_id = v_project.id;

    v_arrangement_manifest := jsonb_set(
      v_base_arrangement.manifest,
      '{projectId}',
      to_jsonb(v_target_project.id)
    );
    v_arrangement_manifest := private.canonical_manifest_v3(
      v_arrangement_manifest,
      v_target_project.id,
      NULL
    );
    v_arrangement_hash := encode(
      extensions.digest(convert_to(v_arrangement_manifest::text, 'UTF8'), 'sha256'),
      'hex'
    );

    INSERT INTO public.arrangement_versions (
      project_id,
      created_by,
      create_request_id,
      manifest_version,
      engine,
      engine_version,
      manifest,
      manifest_sha256,
      tempo_bpm,
      time_signature_numerator,
      time_signature_denominator,
      musical_key,
      ppq,
      duration_ticks
    ) VALUES (
      v_target_project.id,
      v_actor,
      p_request_id,
      3,
      'openmidi-midi',
      'openmidi-midi-3_tone-15.1.22_presets-1',
      v_arrangement_manifest,
      v_arrangement_hash,
      v_base_arrangement.tempo_bpm,
      v_base_arrangement.time_signature_numerator,
      v_base_arrangement.time_signature_denominator,
      v_base_arrangement.musical_key,
      v_base_arrangement.ppq,
      v_base_arrangement.duration_ticks
    )
    RETURNING * INTO v_target_arrangement;

    INSERT INTO public.arrangement_tracks (
      arrangement_version_id,
      project_id,
      track_id,
      sort_order,
      name,
      preset_id,
      preset_version,
      gain_db,
      pan,
      muted,
      soloed
    )
    SELECT
      v_target_arrangement.id,
      v_target_project.id,
      source.track_id,
      source.sort_order,
      source.name,
      source.preset_id,
      source.preset_version,
      source.gain_db,
      source.pan,
      source.muted,
      source.soloed
    FROM public.arrangement_tracks source
    WHERE source.arrangement_version_id = v_base_arrangement.id;

    INSERT INTO public.arrangement_clips (
      arrangement_version_id,
      project_id,
      track_id,
      clip_id,
      midi_pattern_version_id,
      start_tick,
      duration_ticks,
      source_start_tick,
      loop
    )
    SELECT
      v_target_arrangement.id,
      v_target_project.id,
      source.track_id,
      source.clip_id,
      source.midi_pattern_version_id,
      source.start_tick,
      source.duration_ticks,
      source.source_start_tick,
      source.loop
    FROM public.arrangement_clips source
    WHERE source.arrangement_version_id = v_base_arrangement.id;

    INSERT INTO public.project_revisions (
      project_id,
      revision_number,
      parent_revision_id,
      created_by,
      publish_request_id,
      expected_base_revision_id,
      message,
      manifest,
      manifest_version,
      engine,
      engine_version,
      manifest_sha256,
      duration_ms,
      arrangement_version_id
    ) VALUES (
      v_target_project.id,
      1,
      NULL,
      v_actor,
      p_request_id,
      NULL,
      'Recovered from revision ' || v_base_revision.revision_number,
      v_arrangement_manifest,
      3,
      'openmidi-midi',
      'openmidi-midi-3_tone-15.1.22_presets-1',
      v_arrangement_hash,
      ceil(
        v_target_arrangement.duration_ticks * 60000.0
        / (v_target_arrangement.tempo_bpm * v_target_arrangement.ppq)
      ),
      v_target_arrangement.id
    )
    RETURNING * INTO v_target_revision;

    UPDATE public.projects
    SET current_revision_id = v_target_revision.id,
      status = 'active',
      visibility = 'private',
      open_to_contributions = false,
      published_at = statement_timestamp(),
      lock_version = lock_version + 1,
      updated_at = statement_timestamp()
    WHERE id = v_target_project.id
    RETURNING * INTO v_target_project;

    v_workspace_manifest := jsonb_set(
      jsonb_set(
        v_workspace.manifest,
        '{projectId}',
        to_jsonb(v_target_project.id)
      ),
      '{workspaceId}',
      to_jsonb(v_target_workspace_id)
    );
    v_workspace_manifest := private.canonical_manifest_v3(
      v_workspace_manifest,
      v_target_project.id,
      v_target_workspace_id
    );
    v_workspace_hash := encode(
      extensions.digest(convert_to(v_workspace_manifest::text, 'UTF8'), 'sha256'),
      'hex'
    );

    INSERT INTO public.workspaces (
      id,
      project_id,
      owner_id,
      create_request_id,
      base_revision_id,
      manifest,
      manifest_version,
      engine,
      engine_version,
      manifest_sha256
    ) VALUES (
      v_target_workspace_id,
      v_target_project.id,
      v_actor,
      p_request_id,
      v_target_revision.id,
      v_workspace_manifest,
      3,
      'openmidi-midi',
      'openmidi-midi-3_tone-15.1.22_presets-1',
      v_workspace_hash
    )
    RETURNING * INTO v_target_workspace;

    PERFORM private.replace_workspace_projection_v3(
      v_target_workspace.id,
      v_workspace_manifest
    );

    INSERT INTO private.workspace_snapshots (
      workspace_id,
      project_id,
      owner_id,
      request_id,
      lock_version,
      manifest,
      manifest_sha256
    ) VALUES (
      v_target_workspace.id,
      v_target_workspace.project_id,
      v_actor,
      p_request_id,
      v_target_workspace.lock_version,
      v_workspace_manifest,
      v_workspace_hash
    );

    UPDATE public.workspaces
    SET status = 'archived',
      updated_at = statement_timestamp()
    WHERE id = v_workspace.id;

    INSERT INTO public.activity_events (
      actor_id,
      project_id,
      subject_id,
      event_type,
      payload
    ) VALUES (
      v_actor,
      v_target_project.id,
      v_target_revision.id,
      'project_forked',
      jsonb_build_object('revisionNumber', 1)
    );
  END IF;

  INSERT INTO private.stale_owner_workspace_resolutions (
    actor_id,
    request_id,
    source_project_id,
    source_workspace_id,
    source_base_revision_id,
    observed_current_revision_id,
    expected_workspace_lock_version,
    resolution,
    normalized_fork_title,
    target_project_id,
    target_workspace_id,
    target_base_revision_id
  ) VALUES (
    v_actor,
    p_request_id,
    v_project.id,
    v_workspace.id,
    v_base_revision.id,
    v_current_revision.id,
    p_expected_workspace_lock_version,
    p_resolution,
    v_fork_title,
    v_target_project.id,
    v_target_workspace.id,
    v_target_revision.id
  )
  RETURNING * INTO v_receipt;

  RETURN QUERY
  SELECT
    v_receipt.resolution,
    v_receipt.source_project_id,
    v_receipt.source_workspace_id,
    v_receipt.target_project_id,
    v_receipt.target_workspace_id,
    v_receipt.target_base_revision_id,
    v_target_workspace.lock_version,
    v_receipt.created_at;
END;
$$;

ALTER FUNCTION "public"."resolve_stale_owner_workspace_v3"(
  uuid,
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text
) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."resolve_stale_owner_workspace_v3"(
  uuid,
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text
) IS
  'Atomically resolves a stale active owner workspace by restarting from current authority or preserving the acknowledged draft in a private direct fork.';

REVOKE ALL ON FUNCTION "public"."resolve_stale_owner_workspace_v3"(
  uuid,
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."resolve_stale_owner_workspace_v3"(
  uuid,
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text
) FROM "anon";

GRANT EXECUTE ON FUNCTION "public"."resolve_stale_owner_workspace_v3"(
  uuid,
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text
) TO "authenticated";
