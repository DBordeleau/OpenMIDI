import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const contributorId = "fa000000-0000-4000-8000-000000000002";

function localSupabaseEnv() {
  const output =
    process.platform === "win32"
      ? execFileSync(
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", "npx supabase status -o env"],
          { encoding: "utf8" },
        )
      : execFileSync("npx", ["supabase", "status", "-o", "env"], {
          encoding: "utf8",
        });
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([^=]+)="(.*)"$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2]]),
  );
}

function queryLocalDatabase(sql: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_jam-session",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();
}

async function setupMidiCollaborationFixture() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  )
    throw new Error("Refusing collaboration fixture outside local Supabase.");
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const owner = users.users.find(
    (user) => user.email === process.env.TEST_AUTH_EMAIL,
  );
  if (!owner) throw new Error("Run npm run auth:e2e:setup first.");

  const sql = `
    begin;
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values('00000000-0000-0000-0000-000000000000','${contributorId}','authenticated','authenticated','collaboration-v3-contributor@example.test','','','','','','{}','{}',now(),now())
    on conflict(id) do nothing;
    update public.profiles set username='V3BrowserOwner',username_normalized='v3browserowner',display_name='V3 Browser Owner',credit_name='V3 Browser Owner',profile_completed_at=coalesce(profile_completed_at,now()) where id='${owner.id}';
    update public.profiles set username='V3BrowserContributor',username_normalized='v3browsercontributor',display_name='V3 Browser Contributor',credit_name='V3 Browser Contributor',profile_completed_at=now() where id='${contributorId}';

    set local role authenticated;
    set local request.jwt.claim.sub='${owner.id}';
    select public.create_midi_pattern_v3('fa100000-0000-4000-8000-000000000001','Browser lineage pattern');
    select public.create_midi_pattern_version_v3(
      (select id from public.midi_patterns where create_request_id='fa100000-0000-4000-8000-000000000001'),
      'fa110000-0000-4000-8000-000000000001',1,480::smallint,1920,
      '[{"noteId":"fa120000-0000-4000-8000-000000000001","startTick":0,"durationTicks":480,"pitch":64,"velocity":96},{"noteId":"fa120000-0000-4000-8000-000000000002","startTick":720,"durationTicks":240,"pitch":67,"velocity":84},{"noteId":"fa120000-0000-4000-8000-000000000003","startTick":1440,"durationTicks":240,"pitch":60,"velocity":72}]'::jsonb,
      true,'cc-by-4.0-attestation-v1');
    select public.create_midi_project_workspace_v3(
      'fa200000-0000-4000-8000-000000000001','V3 collaboration browser','',120::numeric,'c-major',4::smallint,4::smallint,
      'cc-by-4.0','{}'::uuid[],null::uuid,'{}'::uuid[]);
    select public.save_midi_workspace_v3(
      (select id from public.workspaces where create_request_id='fa200000-0000-4000-8000-000000000001'),
      'fa210000-0000-4000-8000-000000000001',1,
      jsonb_build_object('manifestVersion',3,'engine','jam-session-midi','engineVersion','jam-session-midi-3_tone-15.1.22_presets-1',
        'projectId',(select project_id from public.workspaces where create_request_id='fa200000-0000-4000-8000-000000000001'),
        'workspaceId',(select id from public.workspaces where create_request_id='fa200000-0000-4000-8000-000000000001'),
        'tempoBpm',120,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),'musicalKey','c-major','ppq',480,'durationTicks',7680,
        'tracks',jsonb_build_array(jsonb_build_object('trackId','fa220000-0000-4000-8000-000000000001','sortOrder',0,'name','Keys',
          'presetId','warm-keys','presetVersion',1,'gainDb',0,'pan',0,'muted',false,'soloed',false,
          'clips',jsonb_build_array(jsonb_build_object('clipId','fa230000-0000-4000-8000-000000000001',
            'midiPatternVersionId',(select id from public.midi_pattern_versions where create_request_id='fa110000-0000-4000-8000-000000000001'),
            'startTick',0,'durationTicks',1920,'sourceStartTick',0,'loop',false)))))
    );
    select public.publish_midi_workspace_revision_v3(
      (select id from public.workspaces where create_request_id='fa200000-0000-4000-8000-000000000001'),
      'fa240000-0000-4000-8000-000000000001',2,null,'Exact source');
    reset role;

    update public.projects set visibility='public',open_to_contributions=true
      where create_request_id='fa200000-0000-4000-8000-000000000001';
    insert into public.project_members(project_id,user_id,role,created_by)
    select id,'${contributorId}','editor','${owner.id}' from public.projects
      where create_request_id='fa200000-0000-4000-8000-000000000001';

    set local role authenticated;
    set local request.jwt.claim.sub='${contributorId}';
    select public.create_midi_pattern_v3(
      'fa100000-0000-4000-8000-000000000002','Submitted comparison pattern',
      (select id from public.midi_pattern_versions where create_request_id='fa110000-0000-4000-8000-000000000001'));
    select public.create_midi_pattern_version_v3(
      (select id from public.midi_patterns where create_request_id='fa100000-0000-4000-8000-000000000002'),
      'fa110000-0000-4000-8000-000000000002',1,480::smallint,1920,
      '[{"noteId":"fa120000-0000-4000-8000-000000000001","startTick":240,"durationTicks":720,"pitch":65,"velocity":110},{"noteId":"fa120000-0000-4000-8000-000000000004","startTick":1200,"durationTicks":240,"pitch":72,"velocity":100},{"noteId":"fa120000-0000-4000-8000-000000000003","startTick":1440,"durationTicks":240,"pitch":60,"velocity":72}]'::jsonb,
      true,'cc-by-4.0-attestation-v1');
    select public.create_contribution_workspace_v3(
      (select id from public.projects where create_request_id='fa200000-0000-4000-8000-000000000001'),
      'fa300000-0000-4000-8000-000000000001',
      (select current_revision_id from public.projects where create_request_id='fa200000-0000-4000-8000-000000000001'),
      'V3 browser proposal','Exact MIDI-only proposal');
    select public.save_midi_workspace_v3(
      (select id from public.workspaces where contribution_id is not null and owner_id='${contributorId}'),
      'fa310000-0000-4000-8000-000000000001',1,
      jsonb_set(jsonb_set(jsonb_set(
        (select manifest from public.workspaces where contribution_id is not null and owner_id='${contributorId}'),
        '{tempoBpm}','132'::jsonb),'{tracks,0,name}','"Changed keys"'::jsonb),
        '{tracks,0,clips,0,midiPatternVersionId}',
        to_jsonb((select id::text from public.midi_pattern_versions where create_request_id='fa110000-0000-4000-8000-000000000002'))));
    select public.submit_contribution_v3(
      (select id from public.contributions where author_id='${contributorId}'),
      'fa320000-0000-4000-8000-000000000001',2,
      (select base_revision_id from public.contributions where author_id='${contributorId}'),
      (select manifest_sha256 from public.workspaces where contribution_id is not null and owner_id='${contributorId}'),
      'contributor-attestation-v1');
    reset role;
    commit;
  `;
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
  return JSON.parse(
    queryLocalDatabase(`select json_build_object(
      'projectId',c.project_id,'contributionId',c.id,'versionId',c.current_version_id,
      'baseRevisionId',c.base_revision_id,'patternVersionId',ac.midi_pattern_version_id
    )::text from public.contributions c
    join public.contribution_versions cv on cv.id=c.current_version_id
    join public.arrangement_clips ac on ac.arrangement_version_id=cv.arrangement_version_id
    where c.author_id='${contributorId}' limit 1`),
  ) as {
    projectId: string;
    contributionId: string;
    versionId: string;
    baseRevisionId: string;
    patternVersionId: string;
  };
}

test.describe("MIDI v3 collaboration", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth and Postgres fixture",
  );

  test("reviews, accepts, attributes, and forks one exact MIDI v3 contribution", async ({
    page,
  }) => {
    const fixture = await setupMidiCollaborationFixture();
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await page.waitForURL(/\/(onboarding|settings\/profile)$/);
    await page.goto(
      `/projects/${fixture.projectId}/contributions/${fixture.contributionId}`,
    );
    await expect(
      page.getByRole("heading", { name: "Contribution comparison" }),
    ).toBeVisible();
    await expect(page.getByText("Arrangement metadata")).toBeVisible();
    await expect(
      page.getByText("Tracks and clips", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("V3 Browser Owner", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("CC-BY-4.0").first()).toBeVisible();

    const noteComparison = page
      .getByRole("heading", { name: /Note comparison/ })
      .locator("..");
    await expect(
      noteComparison.getByRole("button", { name: "+ 1 Added" }),
    ).toBeVisible();
    await expect(
      noteComparison.getByRole("button", { name: "~ 1 Changed" }),
    ).toBeVisible();
    await expect(
      noteComparison.getByRole("button", { name: "− 1 Removed" }),
    ).toBeVisible();
    await expect(
      noteComparison.getByRole("list", { name: "Note comparison legend" }),
    ).toContainText("dashed outline");
    await expect(noteComparison.getByText(/Base revision: E4/)).toBeVisible();
    await expect(
      noteComparison.getByText(/Submitted version: F4/),
    ).toBeVisible();
    const changedBefore = noteComparison.locator(
      '[data-note-state="changed"][data-note-side="before"] rect',
    );
    const changedAfter = noteComparison.locator(
      '[data-note-state="changed"][data-note-side="after"] rect',
    );
    await expect(changedBefore).toHaveCount(1);
    await expect(changedAfter).toHaveCount(1);
    expect(await changedBefore.getAttribute("x")).not.toBe(
      await changedAfter.getAttribute("x"),
    );
    expect(await changedBefore.getAttribute("width")).not.toBe(
      await changedAfter.getAttribute("width"),
    );
    expect(await changedBefore.getAttribute("y")).not.toBe(
      await changedAfter.getAttribute("y"),
    );

    await page.getByRole("button", { name: "Play Base revision" }).click();
    await expect(page.getByText(/Now playing Base revision/)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Play Submitted version" }).click();
    await expect(
      page.getByText(/Now playing Submitted version.*other side is stopped/),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: "Play Base revision" }),
    ).toHaveAttribute("aria-pressed", "false");

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Accept contribution" }).click();
    await expect(page.getByText("Accepted as revision 2.")).toBeVisible();

    const accepted = JSON.parse(
      queryLocalDatabase(`select json_build_object(
      'revisionId',r.id,
      'sameArrangement',r.arrangement_version_id=cv.arrangement_version_id,
      'parentRevisionId',r.parent_revision_id,
      'publisher',(select credit_name from public.revision_attributions where revision_id=r.id and kind='publisher'),
      'contributor',(select credit_name from public.revision_attributions where revision_id=r.id and kind='accepted_contributor')
    )::text from public.project_revisions r
    join public.contribution_versions cv on cv.id=r.accepted_contribution_version_id
    where r.accepted_contribution_id='${fixture.contributionId}'`),
    ) as Record<string, unknown>;
    expect(accepted).toMatchObject({
      sameArrangement: true,
      parentRevisionId: fixture.baseRevisionId,
      publisher: "V3 Browser Owner",
      contributor: "V3 Browser Contributor",
    });
    const acceptedRevisionId = String(accepted.revisionId);

    queryLocalDatabase(
      `update public.profiles set credit_name='Renamed contributor' where id='${contributorId}' returning id`,
    );
    expect(
      queryLocalDatabase(
        `select credit_name from public.revision_attributions where revision_id='${acceptedRevisionId}' and kind='accepted_contributor'`,
      ),
    ).toBe("V3 Browser Contributor");

    await page.goto(
      `/projects/${fixture.projectId}/fork?revision=${acceptedRevisionId}`,
    );
    await page.getByLabel("Project title").fill("V3 exact lineage fork");
    await page.getByLabel(/preserve CC BY 4.0 attribution/).check();
    await page.getByRole("button", { name: "Create private fork" }).click();
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}\?forked=1$/);

    const fork = JSON.parse(
      queryLocalDatabase(`select json_build_object(
      'sourceProjectId',p.source_project_id,'sourceRevisionId',p.source_revision_id,
      'patternVersionId',ac.midi_pattern_version_id,
      'patternVersionCount',(select count(*) from public.midi_pattern_versions)
    )::text from public.projects p
    join public.project_revisions r on r.project_id=p.id and r.id=p.current_revision_id
    join public.arrangement_clips ac on ac.arrangement_version_id=r.arrangement_version_id
    where p.title='V3 exact lineage fork'`),
    ) as Record<string, unknown>;
    expect(fork).toMatchObject({
      sourceProjectId: fixture.projectId,
      sourceRevisionId: acceptedRevisionId,
      patternVersionId: fixture.patternVersionId,
      patternVersionCount: 2,
    });
  });
});
