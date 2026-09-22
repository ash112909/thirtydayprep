-- Which scene theme (the doghouse/cathouse backdrop's color palette) the
-- student has equipped. Ownership of non-default themes is tracked the
-- same way as toys/food — a row in pet_inventory with quantity > 0 — so
-- this column only needs to record the *selection* among owned themes.
-- Null/missing means the default "classic" theme.

alter table study_pets add column equipped_theme text;
