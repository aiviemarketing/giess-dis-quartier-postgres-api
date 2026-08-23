-- The historical seed inserts explicit RADOLAN geometry IDs but does not
-- advance or own its serial sequence. Align it once so later local CPC cell
-- inserts receive fresh IDs rather than colliding with seeded rows.

ALTER SEQUENCE public.radolan_geometry_id_seq
  OWNED BY public.radolan_geometry.id;

SELECT setval(
  'public.radolan_geometry_id_seq',
  GREATEST(COALESCE((SELECT MAX(id) FROM public.radolan_geometry), 1), 1),
  true
);
