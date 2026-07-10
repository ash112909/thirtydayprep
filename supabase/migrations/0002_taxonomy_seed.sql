-- Seed the fixed taxonomy for the digital SAT: 2 sections, 4 domains each.
-- This is reference data (not user data) so it lives in a migration, not the
-- question-bank import script.

insert into categories (slug, name, sort_order) values
  ('reading-writing', 'Reading and Writing', 1),
  ('math', 'Math', 2);

insert into subcategories (category_id, slug, name, sort_order)
select c.id, v.slug, v.name, v.sort_order
from categories c
join (values
  ('reading-writing', 'information-and-ideas', 'Information and Ideas', 1),
  ('reading-writing', 'craft-and-structure', 'Craft and Structure', 2),
  ('reading-writing', 'expression-of-ideas', 'Expression of Ideas', 3),
  ('reading-writing', 'standard-english-conventions', 'Standard English Conventions', 4),
  ('math', 'algebra', 'Algebra', 1),
  ('math', 'advanced-math', 'Advanced Math', 2),
  ('math', 'problem-solving-data-analysis', 'Problem-Solving and Data Analysis', 3),
  ('math', 'geometry-trigonometry', 'Geometry and Trigonometry', 4)
) as v(category_slug, slug, name, sort_order)
  on v.category_slug = c.slug;
