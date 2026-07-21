-- Adds support for grid-in ("student produced response") questions, the SAT
-- Math format where the student types a numeric/short answer instead of
-- picking from options. Roughly a quarter of the real question bank turned
-- out to be this format rather than pure multiple-choice.

create type question_type as enum ('multiple_choice', 'grid_in');

alter table questions
  add column question_type question_type not null default 'multiple_choice',
  add column correct_value text, -- grid-in answer, compared as normalized text (handles symbolic/multi-part answers like "14π" or "120, 60, 60")
  add column calculator_allowed boolean;

alter table questions alter column choices drop not null;
alter table questions alter column correct_choice drop not null;

alter table questions add constraint questions_answer_shape_check check (
  (question_type = 'multiple_choice' and choices is not null and correct_choice is not null)
  or
  (question_type = 'grid_in' and correct_value is not null)
);
