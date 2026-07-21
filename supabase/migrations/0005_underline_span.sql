-- Many reading/grammar questions reference "the underlined portion" of the
-- passage, but the source question bank never captured which text that
-- was — only the question wording says so. These columns record a
-- best-effort detected span (character offsets into `passage`) so the app
-- can actually render the underline instead of leaving students staring at
-- a passage with no marked reference. Left null where no span could be
-- confidently located (see scripts/export-firestore-questions.mjs).

alter table questions
  add column passage_underline_start int,
  add column passage_underline_end int;

alter table questions add constraint questions_underline_span_check check (
  (passage_underline_start is null and passage_underline_end is null)
  or
  (
    passage_underline_start is not null
    and passage_underline_end is not null
    and passage_underline_start >= 0
    and passage_underline_end > passage_underline_start
  )
);
