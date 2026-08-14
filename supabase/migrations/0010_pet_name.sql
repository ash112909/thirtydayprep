-- Lets a student give their study buddy a name. Nullable — falls back to a
-- generic "Your study buddy" label in the UI until set.
alter table study_pets add column name text;
