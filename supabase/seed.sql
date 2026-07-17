-- Deterministic MIDI-only local/CI seed. Product rows used by individual tests are
-- created transactionally by their owning fixture so pgTAP isolation stays exact.
begin;

insert into public.reserved_usernames (username_normalized, reason) values
  ('admin','administrative role confusion'),('administrator','administrative role confusion'),
  ('api','application route'),('auth','application route'),('explore','application route'),
  ('help','support route'),('jam_session','product identity'),('jamsession','product identity'),
  ('moderator','moderation role confusion'),('null','system value confusion'),
  ('projects','application route'),('root','administrative role confusion'),
  ('settings','application route'),('studio','application route'),
  ('support','support identity confusion'),('system','system identity confusion'),
  ('undefined','system value confusion'),('www','host name confusion');

insert into public.licenses(code,name,url,summary,allows_derivatives,requires_attribution,share_alike,sort_order) values
  ('all-rights-reserved','All rights reserved','https://jamsession.example/licenses/all-rights-reserved','No contribution or reuse permission is granted.',false,false,false,0),
  ('cc-by-4.0','CC BY 4.0','https://creativecommons.org/licenses/by/4.0/','Derivatives are allowed with attribution.',true,true,false,1),
  ('cc-by-sa-4.0','CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/','Derivatives are allowed with attribution and share-alike.',true,true,true,2),
  ('cc0-1.0','CC0 1.0','https://creativecommons.org/publicdomain/zero/1.0/','Public-domain dedication where legally effective.',true,false,false,3);

insert into public.genres(id,slug,name,sort_order) values
  ('10000000-0000-4000-8000-000000000001','electronic','Electronic',1),
  ('10000000-0000-4000-8000-000000000002','hip-hop','Hip-hop',2),
  ('10000000-0000-4000-8000-000000000003','rock','Rock',3),
  ('10000000-0000-4000-8000-000000000004','pop','Pop',4),
  ('10000000-0000-4000-8000-000000000005','r-and-b','R&B',5),
  ('10000000-0000-4000-8000-000000000006','jazz','Jazz',6),
  ('10000000-0000-4000-8000-000000000007','classical','Classical',7),
  ('10000000-0000-4000-8000-000000000008','folk','Folk',8),
  ('10000000-0000-4000-8000-000000000009','country','Country',9),
  ('10000000-0000-4000-8000-00000000000a','metal','Metal',10),
  ('10000000-0000-4000-8000-00000000000b','ambient','Ambient',11),
  ('10000000-0000-4000-8000-00000000000c','experimental','Experimental',12);

insert into public.tags(id,slug,display_name,sort_order) values
  ('20000000-0000-4000-8000-000000000001','collaboration-wanted','Collaboration wanted',1),
  ('20000000-0000-4000-8000-000000000002','remix-friendly','Remix friendly',2),
  ('20000000-0000-4000-8000-000000000003','work-in-progress','Work in progress',3),
  ('20000000-0000-4000-8000-000000000004','instrumental','Instrumental',4),
  ('20000000-0000-4000-8000-000000000005','melodic','Melodic',5),
  ('20000000-0000-4000-8000-000000000006','rhythmic','Rhythmic',6),
  ('20000000-0000-4000-8000-000000000007','bass-heavy','Bass-heavy',7),
  ('20000000-0000-4000-8000-000000000008','harmonic','Harmonic',8),
  ('20000000-0000-4000-8000-000000000009','keys-led','Keys-led',9),
  ('20000000-0000-4000-8000-00000000000a','minimal','Minimal',10),
  ('20000000-0000-4000-8000-00000000000b','maximal','Maximal',11),
  ('20000000-0000-4000-8000-00000000000c','upbeat','Upbeat',12),
  ('20000000-0000-4000-8000-00000000000d','mellow','Mellow',13),
  ('20000000-0000-4000-8000-00000000000e','dark','Dark',14),
  ('20000000-0000-4000-8000-00000000000f','cinematic','Cinematic',15),
  ('20000000-0000-4000-8000-000000000010','loop-friendly','Loop friendly',16);

insert into public.instruments(id,slug,name,sort_order) values
  ('30000000-0000-4000-8000-000000000001','drums-percussion','Drums & percussion',1),
  ('30000000-0000-4000-8000-000000000002','bass','Bass',2),
  ('30000000-0000-4000-8000-000000000003','keys','Keys',3),
  ('30000000-0000-4000-8000-000000000004','leads','Leads',4),
  ('30000000-0000-4000-8000-000000000005','pads-strings','Pads & strings',5),
  ('30000000-0000-4000-8000-000000000006','plucks-bells','Plucks & bells',6),
  ('30000000-0000-4000-8000-000000000007','drum-machine','Drum machine',7),
  ('30000000-0000-4000-8000-000000000008','percussion-rack','Percussion rack',8),
  ('30000000-0000-4000-8000-000000000009','sub-bass','Sub bass',9),
  ('30000000-0000-4000-8000-00000000000a','analog-bass','Analog bass',10),
  ('30000000-0000-4000-8000-00000000000b','warm-keys','Warm keys',11),
  ('30000000-0000-4000-8000-00000000000c','electric-keys','Electric keys',12),
  ('30000000-0000-4000-8000-00000000000d','saw-lead','Saw lead',13),
  ('30000000-0000-4000-8000-00000000000e','warm-pad','Warm pad',14),
  ('30000000-0000-4000-8000-00000000000f','bright-pluck','Bright pluck',15),
  ('30000000-0000-4000-8000-000000000010','mallet','Mallet',16);

insert into private.midi_synth_presets(preset_id,version,min_note,max_note,engine_version) values
  ('drum-machine',1,35,81,'jam-session-midi-3_tone-15.1.22_presets-1'),('electro-kit',1,35,81,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('lofi-kit',1,35,81,'jam-session-midi-3_tone-15.1.22_presets-1'),('percussion-rack',1,35,81,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('sub-bass',1,24,60,'jam-session-midi-3_tone-15.1.22_presets-1'),('analog-bass',1,24,67,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('fm-bass',1,24,72,'jam-session-midi-3_tone-15.1.22_presets-1'),('pluck-bass',1,28,72,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('warm-keys',1,24,108,'jam-session-midi-3_tone-15.1.22_presets-1'),('electric-keys',1,24,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('organ',1,24,108,'jam-session-midi-3_tone-15.1.22_presets-1'),('glass-keys',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('saw-lead',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),('square-lead',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('fm-lead',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),('soft-lead',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('warm-pad',1,24,108,'jam-session-midi-3_tone-15.1.22_presets-1'),('air-pad',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('string-pad',1,24,108,'jam-session-midi-3_tone-15.1.22_presets-1'),('choir-pad',1,36,96,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('muted-pluck',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),('bright-pluck',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('bell',1,48,108,'jam-session-midi-3_tone-15.1.22_presets-1'),('mallet',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1');

insert into public.discovery_state(singleton,version,updated_at)
values(true,1,'2026-07-16T00:00:00Z');

-- Reserved local/CI actor only. The .test TLD cannot receive real sign-ins.
insert into private.signup_invitations(email_normalized,note)
values('jam-session-e2e@example.test','local and CI browser test actor');

commit;
