-- Lets a student regenerate their remaining plan days after changing their
-- SAT date or daily minutes, capped so it's a deliberate action rather than
-- something to spam. regenerations_allowed defaults to 2 (the free-tier
-- number for now) but lives on the row specifically so a future paid tier
-- can raise it per-plan without any code change.

alter table study_plans
  add column regenerations_used int not null default 0,
  add column regenerations_allowed int not null default 2;
