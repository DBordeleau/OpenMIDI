begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_function(
  'public',
  'submit_beta_feedback',
  array['uuid','text','text','text','text','text','text'],
  'serialized submission command keeps its callable signature'
);
select has_function(
  'public',
  'mutate_admin_beta_feedback',
  array['uuid','uuid','text','integer','text','text','text'],
  'serialized administrator command keeps its callable signature'
);

select ok(
  position(
    'from public.profiles p' in lower(pg_get_functiondef(
      'public.submit_beta_feedback(uuid,text,text,text,text,text,text)'::regprocedure
    ))
  ) > 0,
  'submission command locks the durable submitter profile row'
);
select ok(
  position(
    'from public.profiles p' in lower(pg_get_functiondef(
      'public.submit_beta_feedback(uuid,text,text,text,text,text,text)'::regprocedure
    ))
  ) < position(
    'select * into v_existing' in lower(pg_get_functiondef(
      'public.submit_beta_feedback(uuid,text,text,text,text,text,text)'::regprocedure
    ))
  ),
  'submitter lock precedes the idempotency lookup'
);
select ok(
  position(
    'for update' in lower(pg_get_functiondef(
      'public.submit_beta_feedback(uuid,text,text,text,text,text,text)'::regprocedure
    ))
  ) < position(
    'interval ''1 hour''' in lower(pg_get_functiondef(
      'public.submit_beta_feedback(uuid,text,text,text,text,text,text)'::regprocedure
    ))
  ),
  'submitter lock precedes rolling-hour and rolling-day counts'
);

select ok(
  position(
    'from private.app_admins a' in lower(pg_get_functiondef(
      'public.mutate_admin_beta_feedback(uuid,uuid,text,integer,text,text,text)'::regprocedure
    ))
  ) > 0,
  'administrator command locks the durable administrator membership row'
);
select ok(
  position(
    'from private.app_admins a' in lower(pg_get_functiondef(
      'public.mutate_admin_beta_feedback(uuid,uuid,text,integer,text,text,text)'::regprocedure
    ))
  ) < position(
    'select * into v_existing' in lower(pg_get_functiondef(
      'public.mutate_admin_beta_feedback(uuid,uuid,text,integer,text,text,text)'::regprocedure
    ))
  ),
  'administrator lock precedes request-id idempotency lookup'
);
select ok(
  position(
    'from private.app_admins a' in lower(pg_get_functiondef(
      'public.mutate_admin_beta_feedback(uuid,uuid,text,integer,text,text,text)'::regprocedure
    ))
  ) < position(
    'from private.beta_feedback' in lower(pg_get_functiondef(
      'public.mutate_admin_beta_feedback(uuid,uuid,text,integer,text,text,text)'::regprocedure
    ))
  ),
  'administrator serialization is acquired before feedback state is read'
);

select is(
  obj_description(
    'public.submit_beta_feedback(uuid,text,text,text,text,text,text)'::regprocedure,
    'pg_proc'
  ),
  'Submits idempotent rate-limited beta feedback while holding the submitter profile row through the command.',
  'submission concurrency contract is documented in schema metadata'
);
select is(
  obj_description(
    'public.mutate_admin_beta_feedback(uuid,uuid,text,integer,text,text,text)'::regprocedure,
    'pg_proc'
  ),
  'Mutates beta feedback after serializing administrator request-id lookup on the administrator membership row.',
  'administrator concurrency contract is documented in schema metadata'
);

select ok(
  not has_function_privilege(
    'public',
    'public.submit_beta_feedback(uuid,text,text,text,text,text,text)',
    'execute'
  ),
  'serialized submission remains revoked from PUBLIC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.submit_beta_feedback(uuid,text,text,text,text,text,text)',
    'execute'
  ),
  'serialized submission remains granted to authenticated callers'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.mutate_admin_beta_feedback(uuid,uuid,text,integer,text,text,text)',
    'execute'
  ),
  'serialized administrator command does not add a service-role path'
);

select * from finish();
rollback;
