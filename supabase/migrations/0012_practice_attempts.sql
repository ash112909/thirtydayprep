-- Practice-by-topic lets a student drill a subcategory on demand, outside
-- of both the daily plan and the Mistake Bank. Attempts made there go
-- through the same submit-review-attempt function as Mistake Bank retries,
-- but are tagged with their own source so the two remain distinguishable
-- (e.g. "review" specifically means a retry of a question missed before,
-- while "practice" may be a question never attempted before).

alter table question_attempts drop constraint question_attempts_source_check;
alter table question_attempts add constraint question_attempts_source_check
  check (source in ('baseline', 'daily', 'review', 'practice'));
