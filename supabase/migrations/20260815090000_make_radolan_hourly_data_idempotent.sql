-- Keep the existing RADOLAN-compatible data model while allowing Zurich CPC
-- geometry IDs beyond the original smallint range. The unique hourly key makes
-- re-importing the same CPC/DWD cell and timestamp safe.

ALTER TABLE public.radolan_data
  ALTER COLUMN geom_id TYPE integer USING geom_id::integer;

CREATE UNIQUE INDEX radolan_data_geom_id_measured_at_key
  ON public.radolan_data (geom_id, measured_at);
