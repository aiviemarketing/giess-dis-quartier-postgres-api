INSERT INTO storage.buckets (id, name, public)
VALUES ('data_assets', 'data_assets', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public data_assets read access'
  ) THEN
    CREATE POLICY "Public data_assets read access"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'data_assets');
  END IF;
END;
$$;
