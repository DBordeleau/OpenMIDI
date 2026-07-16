begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(29);
select has_function('public','delete_project',array['uuid','uuid','integer'],'delete command exists');
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000001','authenticated','authenticated','owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000002','authenticated','authenticated','other@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000003','authenticated','authenticated','incomplete2@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000004','authenticated','authenticated','suspended2@example.test','','{}','{}',now(),now());
update public.profiles set username='Owner',username_normalized='owner',display_name='Owner',credit_name='Owner',profile_completed_at=now() where id='40000000-0000-0000-0000-000000000001';
update public.profiles set username='Other',username_normalized='other',display_name='Other',credit_name='Other',profile_completed_at=now() where id='40000000-0000-0000-0000-000000000002';
update public.profiles set username='Suspended2',username_normalized='suspended2',display_name='Suspended',credit_name='Suspended',profile_completed_at=now(),status='suspended' where id='40000000-0000-0000-0000-000000000004';
set local role authenticated; set local request.jwt.claim.sub='40000000-0000-0000-0000-000000000001';
select lives_ok($$select public.create_project('50000000-0000-4000-8000-000000000001','First song','A draft',120.125,'c-major',4::smallint,4::smallint,'cc-by-4.0',array['10000000-0000-4000-8000-000000000001'::uuid],'10000000-0000-4000-8000-000000000001',array['20000000-0000-4000-8000-000000000001'::uuid])$$,'owner creates project');
select is((select count(*) from public.projects),1::bigint,'one project created');
select is((select count(*) from public.project_members where role='owner'),1::bigint,'exactly one owner membership');
select is((select count(*) from public.project_genres),1::bigint,'genre persisted');
select is((select count(*) from public.project_tags),1::bigint,'tag persisted');
select lives_ok($$select public.create_project('50000000-0000-4000-8000-000000000001','First song','A draft',120.125,'c-major',4::smallint,4::smallint,'cc-by-4.0',array['10000000-0000-4000-8000-000000000001'::uuid],'10000000-0000-4000-8000-000000000001',array['20000000-0000-4000-8000-000000000001'::uuid])$$,'identical retry succeeds');
select is((select count(*) from public.projects),1::bigint,'retry creates no duplicate');
select throws_ok($$select public.create_project('50000000-0000-4000-8000-000000000001','Different title','A draft',120.125,'c-major',4::smallint,4::smallint,'cc-by-4.0',array['10000000-0000-4000-8000-000000000001'::uuid],'10000000-0000-4000-8000-000000000001',array['20000000-0000-4000-8000-000000000001'::uuid])$$,'PT409','project_request_conflict','conflicting retry rejected');
select lives_ok($$select public.update_project_metadata((select id from public.projects limit 1),1,'Edited song',null,90,null,3::smallint,4::smallint,'all-rights-reserved','{}',null,'{}')$$,'owner edits metadata');
select is((select lock_version from public.projects),2,'changed edit increments version');
select throws_ok($$select public.update_project_metadata((select id from public.projects limit 1),1,'Stale edit',null,90,null,3::smallint,4::smallint,'all-rights-reserved','{}',null,'{}')$$,'PT409','project_edit_conflict','stale edit rejected');
set local request.jwt.claim.sub='40000000-0000-0000-0000-000000000002';
select is((select count(*) from public.projects),0::bigint,'unrelated user cannot read project');
select is((select count(*) from public.project_genres),0::bigint,'unrelated user cannot infer genre join');
select throws_ok($$select public.update_project_metadata((select id from public.projects limit 1),2,'Probe',null,90,null,3::smallint,4::smallint,'all-rights-reserved','{}',null,'{}')$$,'PT404','project_not_found','foreign edit is non-disclosing');
set local request.jwt.claim.sub='40000000-0000-0000-0000-000000000003';
select throws_ok($$select public.create_project(gen_random_uuid(),'Nope',null,null,null,4::smallint,4::smallint,'all-rights-reserved','{}',null,'{}')$$,'PT403','project_actor_ineligible','incomplete actor rejected');
set local request.jwt.claim.sub='40000000-0000-0000-0000-000000000004';
select throws_ok($$select public.create_project(gen_random_uuid(),'Nope',null,null,null,4::smallint,4::smallint,'all-rights-reserved','{}',null,'{}')$$,'PT403','project_actor_ineligible','suspended actor rejected');
reset role; set local role anon;
select throws_ok($$select count(*) from public.projects$$,'42501',null,'anonymous cannot read projects');
select throws_ok($$select public.create_project(gen_random_uuid(),'Nope',null,null,null,4::smallint,4::smallint,'all-rights-reserved','{}',null,'{}')$$,'42501',null,'anonymous cannot execute create');
select throws_ok($$select public.delete_project('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002',1)$$,'42501',null,'anonymous cannot execute delete');

reset role;
insert into public.projects(id,owner_id,create_request_id,title,license_code)
values('51000000-0000-4000-8000-000000000001','40000000-0000-0000-0000-000000000001','51000000-0000-4000-8000-000000000003','Delete me','all-rights-reserved');
insert into public.project_members(project_id,user_id,role,created_by)
values('51000000-0000-4000-8000-000000000001','40000000-0000-0000-0000-000000000001','owner','40000000-0000-0000-0000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub='40000000-0000-0000-0000-000000000002';
select throws_ok($$select public.delete_project('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000004',1)$$,'PT404','project_delete_not_found','foreign delete is non-disclosing');
set local request.jwt.claim.sub='40000000-0000-0000-0000-000000000003';
select throws_ok($$select public.delete_project('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000005',1)$$,'PT403','project_delete_actor_ineligible','incomplete actor cannot delete');
set local request.jwt.claim.sub='40000000-0000-0000-0000-000000000004';
select throws_ok($$select public.delete_project('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000006',1)$$,'PT403','project_delete_actor_ineligible','suspended actor cannot delete');
set local request.jwt.claim.sub='40000000-0000-0000-0000-000000000001';
select throws_ok($$select public.delete_project('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000007',2)$$,'PT409','project_delete_conflict','stale delete is rejected');
select lives_ok($$select public.delete_project('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000008',1)$$,'owner deletes project');
select lives_ok($$select public.delete_project('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000008',1)$$,'identical delete retry succeeds');
reset role;
select ok((select status='deleted' and visibility='private' and not open_to_contributions and deleted_at is not null from public.projects where id='51000000-0000-4000-8000-000000000001'),'delete immediately hides and timestamps project');
select is((select lock_version from public.projects where id='51000000-0000-4000-8000-000000000001'),2,'delete increments lock version');
select is((select count(*) from private.deletion_requests where target_project_id='51000000-0000-4000-8000-000000000001'),1::bigint,'delete retry creates one request record');
select * from finish(); rollback;
