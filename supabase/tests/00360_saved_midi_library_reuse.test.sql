begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(50);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000001','authenticated','authenticated','lib3-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000002','authenticated','authenticated','lib3-reuser@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000003','authenticated','authenticated','lib3-stranger@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000004','authenticated','authenticated','lib3-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='LibThreeOwner',username_normalized='libthreeowner',display_name='LIB Three Owner',credit_name='LIB Three Owner',profile_completed_at=now() where id='fc000000-0000-4000-8000-000000000001';
update public.profiles set username='LibThreeReuser',username_normalized='libthreereuser',display_name='LIB Three Reuser',credit_name='LIB Three Reuser',profile_completed_at=now() where id='fc000000-0000-4000-8000-000000000002';
update public.profiles set username='LibThreeStranger',username_normalized='libthreestranger',display_name='LIB Three Stranger',credit_name='LIB Three Stranger',profile_completed_at=now() where id='fc000000-0000-4000-8000-000000000003';
update public.profiles set username='LibThreeSuspended',username_normalized='libthreesuspended',display_name='LIB Three Suspended',credit_name='LIB Three Suspended',profile_completed_at=now(),status='suspended' where id='fc000000-0000-4000-8000-000000000004';

select has_table('public','saved_midi_patterns','private exact-version bookmark table exists');
select ok((select relrowsecurity from pg_class where oid='public.saved_midi_patterns'::regclass),'saved bookmarks have RLS');
select has_table('private','midi_library_reuses','private immutable reuse provenance exists');
select ok(not exists(select 1 from information_schema.role_table_grants where table_schema='private' and table_name='midi_library_reuses' and grantee in ('anon','authenticated')),'reuse provenance has no direct application grant');
select ok(not has_function_privilege('anon','public.save_midi_library_pattern(uuid,uuid,uuid)','execute'),'anonymous cannot save');
select ok(has_function_privilege('authenticated','public.reuse_midi_library_pattern(uuid,uuid,uuid,text,uuid,integer,text,integer)','execute'),'authenticated actor receives bounded reuse command');
select has_function('public','list_saved_midi_library_pattern_ids',array['uuid[]'],'lightweight exact saved-ID projection exists');
select ok(not has_function_privilege('anon','public.list_saved_midi_library_pattern_ids(uuid[])','execute'),'anonymous cannot query saved IDs');
select ok(pg_get_functiondef('public.list_saved_midi_library_patterns(integer)'::regprocedure) ~ 'coalesce\(p_limit,[[:space:]]*100\)','null collection limit is coalesced before clamping');

insert into public.midi_patterns(id,owner_id,create_request_id,name,visibility,rights_attestation_version,published_at) values
('fc100000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001','fc110000-0000-4000-8000-000000000001','Reusable pulse','public','cc-by-4.0-attestation-v1',now()),
('fc100000-0000-4000-8000-000000000002','fc000000-0000-4000-8000-000000000001','fc110000-0000-4000-8000-000000000002','Reference study','private',null,null);
insert into public.midi_pattern_versions(id,midi_pattern_id,version_number,create_request_id,creator_id,creator_credit_name,ppq,duration_ticks,note_count,content_sha256,reuse_license_code,reuse_license_version,reuse_license_url) values
('fc200000-0000-4000-8000-000000000001','fc100000-0000-4000-8000-000000000001',1,'fc210000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001','LIB Three Owner',480,960,2,repeat('a',64),'CC-BY-4.0','4.0','https://creativecommons.org/licenses/by/4.0/'),
('fc200000-0000-4000-8000-000000000002','fc100000-0000-4000-8000-000000000002',1,'fc210000-0000-4000-8000-000000000002','fc000000-0000-4000-8000-000000000001','LIB Three Owner',480,960,1,repeat('b',64),null,null,null);
insert into public.midi_pattern_notes(midi_pattern_version_id,note_id,start_tick,duration_ticks,pitch,velocity) values
('fc200000-0000-4000-8000-000000000001','fc220000-0000-4000-8000-000000000001',0,240,60,100),
('fc200000-0000-4000-8000-000000000001','fc220000-0000-4000-8000-000000000002',480,240,64,96),
('fc200000-0000-4000-8000-000000000002','fc220000-0000-4000-8000-000000000003',0,480,67,90);
insert into public.midi_library_listings(id,midi_pattern_id,midi_pattern_version_id,owner_id,request_id,request_payload_sha256,rights_payload_sha256,title,description,creator_username,creator_display_name,creator_credit_name,reuse_mode,rights_basis,attestation_version,attested_by,category_code,suggested_preset_id,suggested_preset_version,instrument_family_code,duration_ticks,duration_beats,note_count,min_pitch,max_pitch,polyphony_kind,search_vector) values
('fc300000-0000-4000-8000-000000000001','fc100000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001','fc310000-0000-4000-8000-000000000001',repeat('c',64),repeat('d',64),'Reusable pulse','','LibThreeOwner','LIB Three Owner','LIB Three Owner','commercial_reuse','original','midi-library-commercial-attestation-v1','fc000000-0000-4000-8000-000000000001','rhythm','warm-keys',1,'keys',960,2,2,60,64,'monophonic',to_tsvector('simple','Reusable pulse')),
('fc300000-0000-4000-8000-000000000002','fc100000-0000-4000-8000-000000000002','fc200000-0000-4000-8000-000000000002','fc000000-0000-4000-8000-000000000001','fc310000-0000-4000-8000-000000000002',repeat('e',64),repeat('f',64),'Reference study','','LibThreeOwner','LIB Three Owner','LIB Three Owner','reference_only','original','midi-library-reference-display-attestation-v1','fc000000-0000-4000-8000-000000000001','melody','soft-lead',1,'leads',960,2,1,67,67,'monophonic',to_tsvector('simple','Reference study'));
insert into public.midi_pattern_external_credits(id,listing_id,midi_pattern_version_id,position,credited_name,role,source_url,source_terms) values
('fc320000-0000-4000-8000-000000000001','fc300000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000001',1,'Outside Writer','Composer','https://example.test/source','Authorized CC-compatible source');

insert into public.projects(id,owner_id,create_request_id,title,license_code) values
('fc400000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000002','fc410000-0000-4000-8000-000000000001','Private reuse workspace','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values
('fc400000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000002','owner','fc000000-0000-4000-8000-000000000002');
with m as (select jsonb_build_object('manifestVersion',3,'engine','jam-session-midi','engineVersion','jam-session-midi-3_tone-15.1.22_presets-1','projectId','fc400000-0000-4000-8000-000000000001'::uuid,'workspaceId','fc420000-0000-4000-8000-000000000001'::uuid,'tempoBpm',120,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),'musicalKey','c-major','ppq',480,'durationTicks',1920,'tracks','[]'::jsonb) manifest)
insert into public.workspaces(id,project_id,owner_id,create_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256)
select 'fc420000-0000-4000-8000-000000000001','fc400000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000002','fc430000-0000-4000-8000-000000000001',manifest,3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',encode(extensions.digest(convert_to(manifest::text,'UTF8'),'sha256'),'hex') from m;

set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000002';
select lives_ok($$select public.save_midi_library_pattern('fc300000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000001','fc500000-0000-4000-8000-000000000001')$$,'commercial exact version may be saved');
select lives_ok($$select public.save_midi_library_pattern('fc300000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000001','fc500000-0000-4000-8000-000000000001')$$,'identical save request replays idempotently');
select throws_ok($$select public.save_midi_library_pattern('fc300000-0000-4000-8000-000000000002','fc200000-0000-4000-8000-000000000002',gen_random_uuid())$$,'PT404','midi_library_reuse_source_not_found','reference-only save is rejected authoritatively');
select is((select count(*) from public.saved_midi_patterns),1::bigint,'owner RLS exposes only the saved exact-version row');
select is((select count(*) from public.list_saved_midi_library_patterns()),1::bigint,'private collection projection returns the bookmark');
select is((select count(*) from public.list_saved_midi_library_pattern_ids(array[
  'fc200000-0000-4000-8000-000000000001'::uuid,
  'fc200000-0000-4000-8000-000000000002'::uuid
])),1::bigint,'lightweight projection returns only requested exact saved IDs');
select is((select external_credits->0->>'creditedName' from public.list_saved_midi_library_patterns()),'Outside Writer','saved projection retains external credits');
select is((select count(*) from public.list_owned_private_midi_workspaces()),1::bigint,'only an owned private workspace is offered');
select throws_ok($$select public.get_midi_library_export('fc300000-0000-4000-8000-000000000002','fc200000-0000-4000-8000-000000000002')$$,'PT404','midi_library_reuse_source_not_found','reference-only export is rejected');
select throws_ok($$select public.reuse_midi_library_pattern('fc300000-0000-4000-8000-000000000002','fc200000-0000-4000-8000-000000000002',gen_random_uuid(),'fork',null,null,'Denied copy',0)$$,'PT404','midi_library_reuse_source_not_found','reference-only fork is rejected');
select throws_ok($$select public.reuse_midi_library_pattern('fc300000-0000-4000-8000-000000000002','fc200000-0000-4000-8000-000000000002',gen_random_uuid(),'import','fc420000-0000-4000-8000-000000000001',1,null,0)$$,'PT404','midi_library_reuse_source_not_found','reference-only import is rejected');
select throws_ok($$select public.reuse_midi_library_pattern('fc300000-0000-4000-8000-000000000002','fc200000-0000-4000-8000-000000000002',gen_random_uuid(),'open_editor','fc420000-0000-4000-8000-000000000001',1,'Denied editor copy',0)$$,'PT404','midi_library_reuse_source_not_found','reference-only editor copy is rejected');

select lives_ok($$select public.reuse_midi_library_pattern('fc300000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000001','fc510000-0000-4000-8000-000000000001','import','fc420000-0000-4000-8000-000000000001',1,null,0)$$,'exact version imports under optimistic lock');
select is((select lock_version from public.workspaces where id='fc420000-0000-4000-8000-000000000001'),2,'import advances the workspace lock once');
select is((select midi_pattern_version_id from public.workspace_clips where workspace_id='fc420000-0000-4000-8000-000000000001'),'fc200000-0000-4000-8000-000000000001'::uuid,'import creates a normal exact-version workspace clip');
select is((select count(*) from public.project_revisions where project_id='fc400000-0000-4000-8000-000000000001'),0::bigint,'import never publishes a revision');
reset role;
select ok((select source_listing_id='fc300000-0000-4000-8000-000000000001' and external_credits->0->>'creditedName'='Outside Writer' from private.midi_library_reuses where request_id='fc510000-0000-4000-8000-000000000001'),'import audit retains exact listing and credit provenance');
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000002';
select throws_ok($$select public.reuse_midi_library_pattern('fc300000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000001',gen_random_uuid(),'import','fc420000-0000-4000-8000-000000000001',1,null,0)$$,'PT409','midi_library_workspace_conflict','stale import lock is rejected');
select lives_ok($$select public.reuse_midi_library_pattern('fc300000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000001','fc510000-0000-4000-8000-000000000002','fork',null,null,'Owned pulse copy',0)$$,'explicit owned copy-on-write fork succeeds');
reset role;
select ok((select p.owner_id='fc000000-0000-4000-8000-000000000002' and p.source_pattern_version_id='fc200000-0000-4000-8000-000000000001' from public.midi_patterns p join private.midi_library_reuses r on r.derived_pattern_id=p.id where r.request_id='fc510000-0000-4000-8000-000000000002'),'fork is private, owned, and points to the exact source');
select ok((select v.reuse_license_code='CC-BY-4.0' and v.note_count=2 from public.midi_pattern_versions v join private.midi_library_reuses r on r.derived_pattern_version_id=v.id where r.request_id='fc510000-0000-4000-8000-000000000002'),'fork preserves CC grant and notes');
select is((select count(*) from public.midi_pattern_external_credits ec join private.midi_library_reuses r on r.derived_pattern_version_id=ec.midi_pattern_version_id where r.request_id='fc510000-0000-4000-8000-000000000002'),1::bigint,'fork inherits immutable external credit');
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000002';
select throws_ok($$select public.list_midi_library_pattern_version(
  (select pattern_version_id from public.list_owned_midi_library_versions(100) where pattern_name='Owned pulse copy'),
  gen_random_uuid(),'commercial_reuse','original','midi-library-commercial-attestation-v1','',null,null,null,
  'rhythm','warm-keys',1,'{}'::text[],'[]'::jsonb,null
)$$,'PT409','midi_library_derived_rights_basis_required','derived fork cannot be relisted as wholly original');
select lives_ok($$select public.list_midi_library_pattern_version(
  (select pattern_version_id from public.list_owned_midi_library_versions(100) where pattern_name='Owned pulse copy'),
  'fc530000-0000-4000-8000-000000000001','commercial_reuse','authorized_adaptation',
  'midi-library-commercial-attestation-v1','','https://example.test/source','CC BY 4.0 source grant',null,
  'rhythm','warm-keys',1,'{}'::text[],'[]'::jsonb,null
)$$,'derived fork relists with inherited credits and compatible source rights');
reset role;
select is((select rights_basis from public.midi_library_listings where request_id='fc530000-0000-4000-8000-000000000001'),'authorized_adaptation','derived listing records adaptation rights');
select is((select count(*) from public.midi_pattern_external_credits ec join public.midi_library_listings l on l.id=ec.listing_id where l.request_id='fc530000-0000-4000-8000-000000000001'),1::bigint,'derived listing receives an immutable listing-bound inherited-credit snapshot');
select is((select ec.credited_name from public.midi_pattern_external_credits ec join public.midi_library_listings l on l.id=ec.listing_id where l.request_id='fc530000-0000-4000-8000-000000000001'),'Outside Writer','derived listing cannot erase inherited credit identity');
select is((select public.get_public_midi_library_listing(l.id)->'listing'->'externalCredits'->0->>'creditedName' from public.midi_library_listings l where l.request_id='fc530000-0000-4000-8000-000000000001'),'Outside Writer','public detail projects the inherited listing snapshot');
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000002';
select ok((select has_source_lineage and has_inherited_external_credits from public.list_owned_midi_library_versions(100) where pattern_name='Owned pulse copy'),'owner listing projection marks the fork and its inherited credits');
select lives_ok($$select public.reuse_midi_library_pattern('fc300000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000001','fc510000-0000-4000-8000-000000000003','open_editor','fc420000-0000-4000-8000-000000000001',2,'Editable pulse copy',0)$$,'editor path creates and imports an owned child');
reset role;
select ok((select r.derived_pattern_version_id=wc.midi_pattern_version_id and r.clip_id=wc.clip_id from private.midi_library_reuses r join public.workspace_clips wc on wc.workspace_id=r.workspace_id and wc.clip_id=r.clip_id where r.request_id='fc510000-0000-4000-8000-000000000003'),'editor path never edits or imports the public source directly');

reset role;
update public.midi_library_listings set unlisted_at=now(),unlisted_by=owner_id,unlist_request_id=gen_random_uuid() where id='fc300000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000002';
select lives_ok($$select public.get_midi_library_export('fc300000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000001')$$,'saved reference retains safe CC export after creator unlisting');
select is((select source_availability from public.list_saved_midi_library_patterns()),'unlisted','saved collection communicates later unlisting');
reset role;
update public.midi_library_listings set moderation_hidden_at=now() where id='fc300000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000002';
select throws_ok($$select public.get_midi_library_export('fc300000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000001')$$,'PT404','midi_library_reuse_source_not_found','moderation-hidden saved source rejects new reuse');
reset role;
update public.midi_library_listings set moderation_hidden_at=null where id='fc300000-0000-4000-8000-000000000001';
update public.midi_patterns set deleted_at=now() where id='fc100000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000002';
select throws_ok($$select public.get_midi_library_export('fc300000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000001')$$,'PT404','midi_library_reuse_source_not_found','deleted source rejects new reuse without deleting the bookmark');
reset role;
update public.midi_patterns set deleted_at=null where id='fc100000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000002';
select lives_ok($$select public.remove_saved_midi_library_pattern('fc200000-0000-4000-8000-000000000001','fc520000-0000-4000-8000-000000000001')$$,'remove is idempotent command');
select lives_ok($$select public.remove_saved_midi_library_pattern('fc200000-0000-4000-8000-000000000001','fc520000-0000-4000-8000-000000000001')$$,'identical remove replay is harmless');
select is((select count(*) from public.saved_midi_patterns),0::bigint,'removing a bookmark deletes no notes or ownership');

set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000003';
select throws_ok($$select public.save_midi_library_pattern('fc300000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000001',gen_random_uuid())$$,'PT404','midi_library_reuse_source_not_found','unlisted source cannot receive a new bookmark');
select is((select count(*) from public.saved_midi_patterns),0::bigint,'unrelated actor cannot enumerate another private collection');
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000004';
select throws_ok($$select public.save_midi_library_pattern('fc300000-0000-4000-8000-000000000002','fc200000-0000-4000-8000-000000000002',gen_random_uuid())$$,'PT403','midi_library_actor_ineligible','suspended actor cannot save');

select * from finish();
rollback;
