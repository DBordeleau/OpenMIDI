-- Representative prelaunch state for rehearsing the destructive RELEASE-01
-- reconciliation against immutable and append-only musical history.
begin;

insert into public.reserved_usernames(username_normalized, reason) values
(concat('ja','m_session'),'product identity'),
(concat('ja','msession'),'product identity');
update public.licenses
set url=concat('https://','ja','m-session.example/licenses/all-rights-reserved')
where code='all-rights-reserved';
insert into private.signup_invitations(email_normalized,note)
values(concat('ja','m-session-e2e@example.test'),'local and CI browser test actor');

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','fa000000-0000-4000-8000-000000000001','authenticated','authenticated','release-admin@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fa000000-0000-4000-8000-000000000002','authenticated','authenticated','release-artist@example.test','','{}','{}',now(),now());

update public.profiles
set username=case when id='fa000000-0000-4000-8000-000000000001' then 'ReleaseAdmin' else 'ReleaseArtist' end,
    username_normalized=case when id='fa000000-0000-4000-8000-000000000001' then 'releaseadmin' else 'releaseartist' end,
    display_name=case when id='fa000000-0000-4000-8000-000000000001' then 'Release Admin' else 'Release Artist' end,
    credit_name=case when id='fa000000-0000-4000-8000-000000000001' then 'Release Admin' else 'Release Artist' end,
    profile_completed_at=now()
where id in ('fa000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000002');

insert into private.app_admins(user_id,created_by)
values('fa000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001');
insert into private.signup_invitations(email_normalized,note,created_by)
values('release-preserved@example.test','Preserved invitation rehearsal','fa000000-0000-4000-8000-000000000001');
insert into private.beta_feedback(
  id,submitter_id,request_id,kind,summary,details,source_pathname,application_version
) values(
  'fa010000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000002',
  'fa010000-0000-4000-8000-000000000002','bug','Preserved feedback',
  'Representative feedback remains available after the musical reset.','/feedback','release-rehearsal'
);

insert into public.assets(
  id,owner_id,status,bucket,object_path,original_filename,declared_media_type,reserved_byte_size,
  media_type,byte_size,sha256,verification_version,image_width,image_height,frame_count,ready_at
) values(
  'fa020000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001','ready','profile-images',
  'fa000000-0000-4000-8000-000000000001/fa020000-0000-4000-8000-000000000001/original',
  'avatar.png','image/png',1024,'image/png',1024,repeat('a',64),'profile-image-v1',512,512,1,now()
);
insert into public.profile_avatar_versions(
  id,profile_id,source_asset_id,public_object_path,status,media_type,byte_size,sha256,width,height,installed_at
) values(
  'fa030000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001',
  'fa020000-0000-4000-8000-000000000001',
  'fa000000-0000-4000-8000-000000000001/fa030000-0000-4000-8000-000000000001/avatar.webp',
  'current','image/webp',512,repeat('b',64),512,512,now()
);
update public.profiles
set avatar_version_id='fa030000-0000-4000-8000-000000000001',
    avatar_path='fa000000-0000-4000-8000-000000000001/fa030000-0000-4000-8000-000000000001/avatar.webp'
where id='fa000000-0000-4000-8000-000000000001';

insert into public.midi_patterns(id,owner_id,create_request_id,name)
values('fa100000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001',
  'fa100000-0000-4000-8000-000000000002','Release pattern');
insert into public.midi_pattern_versions(
  id,midi_pattern_id,version_number,create_request_id,creator_id,creator_credit_name,
  ppq,duration_ticks,note_count,content_sha256
) values(
  'fa110000-0000-4000-8000-000000000001','fa100000-0000-4000-8000-000000000001',1,
  'fa110000-0000-4000-8000-000000000002','fa000000-0000-4000-8000-000000000001',
  'Release Admin',480,960,1,repeat('c',64)
);
insert into public.midi_pattern_notes(midi_pattern_version_id,note_id,start_tick,duration_ticks,pitch,velocity)
values('fa110000-0000-4000-8000-000000000001','fa120000-0000-4000-8000-000000000001',0,480,60,100);

insert into public.projects(id,owner_id,create_request_id,title,license_code)
values('fa200000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001',
  'fa200000-0000-4000-8000-000000000002','Release project','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values
('fa200000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001','owner','fa000000-0000-4000-8000-000000000001'),
('fa200000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000002','editor','fa000000-0000-4000-8000-000000000001');
insert into public.arrangement_versions(
  id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,
  tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks
) values(
  'fa210000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001',
  'fa000000-0000-4000-8000-000000000001','fa210000-0000-4000-8000-000000000002',3,
  'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1','{}',repeat('d',64),120,4,4,'c-major',480,960
);
insert into public.arrangement_tracks(
  arrangement_version_id,project_id,track_id,sort_order,name,preset_id,preset_version,gain_db,pan,muted,soloed
) values(
  'fa210000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001',
  'fa220000-0000-4000-8000-000000000001',0,'Lead','soft-lead',1,0,0,false,false
);
insert into public.arrangement_clips(
  arrangement_version_id,project_id,track_id,clip_id,midi_pattern_version_id,start_tick,duration_ticks,source_start_tick,loop
) values(
  'fa210000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001',
  'fa220000-0000-4000-8000-000000000001','fa230000-0000-4000-8000-000000000001',
  'fa110000-0000-4000-8000-000000000001',0,960,0,false
);
insert into public.project_revisions(
  id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,engine,
  engine_version,manifest_sha256,duration_ms,arrangement_version_id
) values(
  'fa240000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001',1,
  'fa000000-0000-4000-8000-000000000001','fa240000-0000-4000-8000-000000000002','{}',3,
  'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('e',64),2000,
  'fa210000-0000-4000-8000-000000000001'
);
update public.projects
set status='active',visibility='public',published_at=now(),current_revision_id='fa240000-0000-4000-8000-000000000001',
    open_to_contributions=true,
    rights_attestation_version='cc-by-4.0-reuse-attestation-v1'
where id='fa200000-0000-4000-8000-000000000001';
insert into public.activity_events(actor_id,project_id,subject_id,event_type,payload)
values('fa000000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001',
  'fa240000-0000-4000-8000-000000000001','project_revision_published','{"revisionNumber":1}');

insert into public.contributions(id,project_id,author_id,create_request_id,base_revision_id,title)
values('fa300000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001',
  'fa000000-0000-4000-8000-000000000002','fa300000-0000-4000-8000-000000000002',
  'fa240000-0000-4000-8000-000000000001','Release contribution');
insert into public.contribution_versions(
  id,contribution_id,version_number,submission_request_id,base_revision_id,workspace_lock_version,
  manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,attestation_version,
  created_by,project_id,arrangement_version_id
) values(
  'fa310000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000001',1,
  'fa310000-0000-4000-8000-000000000002','fa240000-0000-4000-8000-000000000001',1,'{}',3,
  'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('f',64),2000,
  'contributor-attestation-v1','fa000000-0000-4000-8000-000000000002',
  'fa200000-0000-4000-8000-000000000001','fa210000-0000-4000-8000-000000000001'
);
update public.contributions
set status='submitted',current_version_id='fa310000-0000-4000-8000-000000000001',submitted_at=now()
where id='fa300000-0000-4000-8000-000000000001';
insert into public.contribution_reviews(
  contribution_id,contribution_version_id,reviewer_id,request_id,requested_decision,applied_decision,
  expected_project_revision_id,note,reason
) values(
  'fa300000-0000-4000-8000-000000000001','fa310000-0000-4000-8000-000000000001',
  'fa000000-0000-4000-8000-000000000001','fa320000-0000-4000-8000-000000000001',
  'request_changes','request_changes','fa240000-0000-4000-8000-000000000001','Please revise this entry.','owner_feedback'
);

insert into private.moderation_reports(
  id,reporter_id,request_id,target_kind,target_project_id,target_label_snapshot,reason,detail
) values(
  'fa400000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000002',
  'fa400000-0000-4000-8000-000000000002','project','fa200000-0000-4000-8000-000000000001',
  'Release project','other','Representative project moderation report.'
);
insert into private.moderation_actions(
  admin_id,request_id,report_id,action,target_kind,target_id,reason,prior_state,resulting_state
) values(
  'fa000000-0000-4000-8000-000000000001','fa410000-0000-4000-8000-000000000001',
  'fa400000-0000-4000-8000-000000000001','hide','project','fa200000-0000-4000-8000-000000000001',
  'Representative moderation action.','visible','hidden'
);

insert into public.challenges(id,slug,created_by,state,published_at,lifecycle_version)
values('fa500000-0000-4000-8000-000000000001','release-rehearsal','fa000000-0000-4000-8000-000000000001','published',now(),2);
insert into public.challenge_versions(
  id,challenge_id,version_number,created_by,create_request_id,title,prompt,description,eligibility_terms,
  presentation_code,opens_at,submissions_close_at,voting_opens_at,voting_closes_at,results_expected_at,
  judging_mode,official_placement_count,constraints,constraints_sha256
) values(
  'fa510000-0000-4000-8000-000000000001','fa500000-0000-4000-8000-000000000001',1,
  'fa000000-0000-4000-8000-000000000001','fa510000-0000-4000-8000-000000000002',
  'Release rehearsal','Hear the exact entry.','Reconciliation fixture.','Original work.','pulse',
  now()-interval '4 days',now()-interval '3 days',now()-interval '2 days',now()-interval '1 day',now()+interval '1 day',
  'hybrid',1,private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":1}}'),repeat('1',64)
);
update public.challenges set current_version_id='fa510000-0000-4000-8000-000000000001'
where id='fa500000-0000-4000-8000-000000000001';
insert into public.challenge_entries(
  id,challenge_id,challenge_version_id,entrant_id,project_id,project_revision_id,project_title_snapshot,
  entrant_username_snapshot,entrant_display_name_snapshot,entrant_credit_name_snapshot,revision_number_snapshot,
  attribution_snapshot,duration_ms_snapshot,display_attestation_version,display_attested_at,facts,evaluation,
  evaluation_sha256,submit_request_id,submitted_at
) values(
  'fa520000-0000-4000-8000-000000000001','fa500000-0000-4000-8000-000000000001',
  'fa510000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000002',
  'fa200000-0000-4000-8000-000000000001','fa240000-0000-4000-8000-000000000001','Release project',
  'ReleaseArtist','Release Artist','Release Artist',1,'[{"kind":"publisher","creditName":"Release Artist"}]',
  2000,'challenge-display-attestation-v1',now(),'{}','{"eligible":true}',repeat('2',64),
  'fa520000-0000-4000-8000-000000000002',now()-interval '3 days'
);
insert into public.challenge_results(
  id,challenge_id,challenge_version_id,result_version,finalized_by,request_id,public_note
) values(
  'fa530000-0000-4000-8000-000000000001','fa500000-0000-4000-8000-000000000001',
  'fa510000-0000-4000-8000-000000000001',1,'fa000000-0000-4000-8000-000000000001',
  'fa530000-0000-4000-8000-000000000002','Representative final result.'
);
insert into public.challenge_result_entries(challenge_result_id,challenge_entry_id,final_vote_total)
values('fa530000-0000-4000-8000-000000000001','fa520000-0000-4000-8000-000000000001',4);
insert into public.challenge_result_placements(challenge_result_id,place,challenge_entry_id,placement_label)
values('fa530000-0000-4000-8000-000000000001',1,'fa520000-0000-4000-8000-000000000001','Winner');
insert into public.challenge_result_community_favorites(challenge_result_id,challenge_entry_id,final_vote_total)
values('fa530000-0000-4000-8000-000000000001','fa520000-0000-4000-8000-000000000001',4);
update public.challenges
set state='completed',completed_at=now(),current_result_id='fa530000-0000-4000-8000-000000000001',lifecycle_version=3
where id='fa500000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000001';
select public.reconcile_current_challenge_awards(
  'fa500000-0000-4000-8000-000000000001','fa540000-0000-4000-8000-000000000001',
  'fa530000-0000-4000-8000-000000000001'
);
reset role;

update public.discovery_state set version=41 where singleton;

commit;
