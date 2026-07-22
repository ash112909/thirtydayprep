-- Mistake Bank lets a student retry a previously-missed question outside of
-- any study plan day (see submit-review-attempt). Those retries still land
-- in question_attempts for history/mastery purposes, so the source enum
-- needs a value for them.

alter table question_attempts drop constraint question_attempts_source_check;
alter table question_attempts add constraint question_attempts_source_check
  check (source in ('baseline', 'daily', 'review'));
