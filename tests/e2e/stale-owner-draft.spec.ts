import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const contributorId = "fb000000-0000-4000-8000-000000000002";

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
      "supabase_db_openmidi",
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

async function setupStaleOwnerDraftFixture() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  ) {
    throw new Error("Refusing stale-draft fixture outside local Supabase.");
  }
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
    insert into auth.users(
      instance_id,id,aud,role,email,encrypted_password,confirmation_token,recovery_token,
      email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
    )
    values(
      '00000000-0000-0000-0000-000000000000','${contributorId}',
      'authenticated','authenticated','stale-draft-contributor@example.test',
      '','','','','','{}','{}',now(),now()
    )
    on conflict(id) do nothing;
    update public.profiles
      set username='DraftBrowserOwner',username_normalized='draftbrowserowner',
        display_name='Draft Browser Owner',credit_name='Draft Browser Owner',
        profile_completed_at=coalesce(profile_completed_at,now())
      where id='${owner.id}';
    update public.profiles
      set username='DraftBrowserContributor',username_normalized='draftbrowsercontributor',
        display_name='Draft Browser Contributor',credit_name='Draft Browser Contributor',
        profile_completed_at=now()
      where id='${contributorId}';

    set local role authenticated;
    set local request.jwt.claim.sub='${owner.id}';
    select public.create_midi_pattern_v3(
      'fb100000-0000-4000-8000-000000000001',
      'Stale draft browser pattern'
    );
    select public.create_midi_pattern_version_v3(
      (select id from public.midi_patterns
       where create_request_id='fb100000-0000-4000-8000-000000000001'),
      'fb110000-0000-4000-8000-000000000001',
      1,
      480::smallint,
      1920,
      '[{"noteId":"fb120000-0000-4000-8000-000000000001","startTick":0,"durationTicks":480,"pitch":64,"velocity":96}]'::jsonb,
      true,
      'cc-by-4.0-attestation-v1'
    );
    select public.create_midi_project_workspace_v3(
      'fb200000-0000-4000-8000-000000000001',
      'Stale draft browser project',
      '',
      120::numeric,
      'c-major',
      4::smallint,
      4::smallint,
      'cc-by-4.0',
      '{}'::uuid[],
      null::uuid,
      '{}'::uuid[]
    );
    select public.save_midi_workspace_v3(
      (select id from public.workspaces
       where create_request_id='fb200000-0000-4000-8000-000000000001'),
      'fb210000-0000-4000-8000-000000000001',
      1,
      jsonb_build_object(
        'manifestVersion',3,
        'engine','openmidi-midi',
        'engineVersion','openmidi-midi-3_tone-15.1.22_presets-1',
        'projectId',(select project_id from public.workspaces
          where create_request_id='fb200000-0000-4000-8000-000000000001'),
        'workspaceId',(select id from public.workspaces
          where create_request_id='fb200000-0000-4000-8000-000000000001'),
        'tempoBpm',120,
        'timeSignature',jsonb_build_object('numerator',4,'denominator',4),
        'musicalKey','c-major',
        'ppq',480,
        'durationTicks',7680,
        'tracks',jsonb_build_array(jsonb_build_object(
          'trackId','fb220000-0000-4000-8000-000000000001',
          'sortOrder',0,
          'name','Published keys',
          'presetId','warm-keys',
          'presetVersion',1,
          'gainDb',0,
          'pan',0,
          'muted',false,
          'soloed',false,
          'clips',jsonb_build_array(jsonb_build_object(
            'clipId','fb230000-0000-4000-8000-000000000001',
            'midiPatternVersionId',(select id from public.midi_pattern_versions
              where create_request_id='fb110000-0000-4000-8000-000000000001'),
            'startTick',0,
            'durationTicks',1920,
            'sourceStartTick',0,
            'loop',false
          ))
        ))
      )
    );
    select public.publish_midi_workspace_revision_v3(
      (select id from public.workspaces
       where create_request_id='fb200000-0000-4000-8000-000000000001'),
      'fb240000-0000-4000-8000-000000000001',
      2,
      null,
      'Source revision 1'
    );
    select public.save_midi_workspace_v3(
      (select id from public.workspaces
       where create_request_id='fb200000-0000-4000-8000-000000000001'),
      'fb250000-0000-4000-8000-000000000001',
      2,
      jsonb_set(
        (select manifest from public.workspaces
         where create_request_id='fb200000-0000-4000-8000-000000000001'),
        '{tracks,0,name}',
        '"Owner recovered keys"'
      )
    );
    reset role;

    update public.projects
      set visibility='public',open_to_contributions=true
      where create_request_id='fb200000-0000-4000-8000-000000000001';
    insert into public.project_members(project_id,user_id,role,created_by)
    select id,'${contributorId}','editor','${owner.id}'
    from public.projects
    where create_request_id='fb200000-0000-4000-8000-000000000001';

    set local role authenticated;
    set local request.jwt.claim.sub='${contributorId}';
    select public.create_contribution_workspace_v3(
      (select id from public.projects
       where create_request_id='fb200000-0000-4000-8000-000000000001'),
      'fb300000-0000-4000-8000-000000000001',
      (select current_revision_id from public.projects
       where create_request_id='fb200000-0000-4000-8000-000000000001'),
      'Accepted browser proposal',
      ''
    );
    select public.save_midi_workspace_v3(
      (select id from public.workspaces
       where contribution_id is not null and owner_id='${contributorId}'),
      'fb310000-0000-4000-8000-000000000001',
      1,
      jsonb_set(
        (select manifest from public.workspaces
         where contribution_id is not null and owner_id='${contributorId}'),
        '{tracks,0,name}',
        '"Accepted contributor keys"'
      )
    );
    select public.submit_contribution_v3(
      (select id from public.contributions where author_id='${contributorId}'),
      'fb320000-0000-4000-8000-000000000001',
      2,
      (select base_revision_id from public.contributions
       where author_id='${contributorId}'),
      (select manifest_sha256 from public.workspaces
       where contribution_id is not null and owner_id='${contributorId}'),
      'contributor-attestation-v1'
    );
    reset role;

    set local role authenticated;
    set local request.jwt.claim.sub='${owner.id}';
    select public.accept_contribution_v3(
      (select id from public.contributions where author_id='${contributorId}'),
      'fb330000-0000-4000-8000-000000000001',
      (select current_version_id from public.contributions
       where author_id='${contributorId}'),
      (select base_revision_id from public.contributions
       where author_id='${contributorId}'),
      'Accepted browser proposal'
    );
    reset role;
    commit;
  `;
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_openmidi",
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
      'projectId',p.id,
      'baseRevisionId',w.base_revision_id,
      'acceptedRevisionId',p.current_revision_id,
      'acceptedArrangementId',r.arrangement_version_id
    )::text
    from public.projects p
    join public.workspaces w on w.project_id=p.id
      and w.owner_id='${owner.id}' and w.contribution_id is null
    join public.project_revisions r on r.id=p.current_revision_id
    where p.create_request_id='fb200000-0000-4000-8000-000000000001'`),
  ) as {
    projectId: string;
    baseRevisionId: string;
    acceptedRevisionId: string;
    acceptedArrangementId: string;
  };
}

test.describe("stale owner draft resolution", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth and Postgres fixture",
  );

  test("preserves a stale owner draft as a private fork and publishes it later", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const fixture = await setupStaleOwnerDraftFixture();

    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await page.waitForURL(/\/(onboarding|settings\/profile)$/);
    await page.goto(`/studio/${fixture.projectId}`);

    await expect(
      page.getByRole("button", {
        name: /Draft based on revision 1.*Resolve/,
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText(
        "This draft is based on revision 1 and must be resolved before it can be published.",
      ),
    ).toBeAttached();
    await expect(
      page.getByRole("button", { name: "Publish immutable revision" }),
    ).toBeDisabled();

    await page
      .getByRole("button", { name: /Draft based on revision 1.*Resolve/ })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Resolve this older draft" }),
    ).toContainText(
      "Revision 2 was published while you were editing revision 1.",
    );
    await page
      .getByRole("button", { name: "Preserve draft as a fork" })
      .click();
    await page.getByLabel("Private fork title").fill("Recovered browser draft");
    await page.getByRole("button", { name: "Create private fork" }).click();
    await page.waitForURL(
      (url) =>
        /^\/studio\/[0-9a-f-]{36}$/i.test(url.pathname) &&
        !url.pathname.endsWith(fixture.projectId),
      { timeout: 30_000 },
    );

    const targetProjectId = new URL(page.url()).pathname.split("/").at(-1);
    expect(targetProjectId).toBeTruthy();
    expect(targetProjectId).not.toBe(fixture.projectId);

    const recovered = JSON.parse(
      queryLocalDatabase(`select json_build_object(
        'isPrivate',p.visibility='private',
        'sourceProjectId',p.source_project_id,
        'sourceRevisionId',p.source_revision_id,
        'revisionNumber',r.revision_number,
        'baseMatches',(
          r.manifest=jsonb_set(
            (select source.manifest from public.project_revisions source
             where source.id='${fixture.baseRevisionId}'),
            '{projectId}',to_jsonb(p.id)
          )
        ),
        'workspaceTrackName',w.manifest#>>'{tracks,0,name}',
        'workspaceBaseRevisionId',w.base_revision_id
      )::text
      from public.projects p
      join public.project_revisions r on r.id=p.current_revision_id
      join public.workspaces w on w.project_id=p.id and w.status='active'
      where p.id='${targetProjectId}'`),
    ) as {
      isPrivate: boolean;
      sourceProjectId: string;
      sourceRevisionId: string;
      revisionNumber: number;
      baseMatches: boolean;
      workspaceTrackName: string;
      workspaceBaseRevisionId: string;
    };
    expect(recovered).toMatchObject({
      isPrivate: true,
      sourceProjectId: fixture.projectId,
      sourceRevisionId: fixture.baseRevisionId,
      revisionNumber: 1,
      baseMatches: true,
      workspaceTrackName: "Owner recovered keys",
    });
    expect(recovered.workspaceBaseRevisionId).not.toBe(fixture.baseRevisionId);

    const publish = page.getByRole("button", {
      name: "Publish immutable revision",
    });
    await expect(publish).toBeEnabled({ timeout: 30_000 });
    await publish.click();
    await expect(
      page.getByText(
        "Revision 2 published with exact pattern and arrangement versions.",
      ),
    ).toBeVisible({ timeout: 30_000 });

    const outcome = JSON.parse(
      queryLocalDatabase(`select json_build_object(
        'forkRevisionNumber',(
          select revision_number from public.project_revisions
          where id=(select current_revision_id from public.projects
                    where id='${targetProjectId}')
        ),
        'originalCurrentRevisionId',p.current_revision_id,
        'originalArrangementId',r.arrangement_version_id,
        'originalAcceptedContribution',r.accepted_contribution_id is not null
      )::text
      from public.projects p
      join public.project_revisions r on r.id=p.current_revision_id
      where p.id='${fixture.projectId}'`),
    ) as {
      forkRevisionNumber: number;
      originalCurrentRevisionId: string;
      originalArrangementId: string;
      originalAcceptedContribution: boolean;
    };
    expect(outcome).toEqual({
      forkRevisionNumber: 2,
      originalCurrentRevisionId: fixture.acceptedRevisionId,
      originalArrangementId: fixture.acceptedArrangementId,
      originalAcceptedContribution: true,
    });
  });
});
