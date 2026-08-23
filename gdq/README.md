# Güss dis Quartier local adaptations

This directory contains Zurich-specific tooling. It deliberately does not alter
the upstream Supabase schema, functions, or application code.

## Zurich trees

`scripts/sync-zurich-trees.mjs` downloads the official City of Zurich
Baumkataster from its public WFS, validates the live GeoJSON contract, and
normalises it for the existing `public.trees` table.

The importer is dry-run by default. It reports source, validation, and mapping
counts without changing the database.

```bash
source /Users/Adrian/.nvm/nvm.sh
nvm use
node gdq/scripts/sync-zurich-trees.mjs
```

To replace the **local** upstream seed with Zurich trees, start local Supabase
and run the importer as the local database owner. This is necessary because the
upstream tree-statistics triggers refresh materialized views that the REST
service role cannot own. The importer disables those three triggers only for
the local replacement, then refreshes the views once after the import.

```bash
GDQ_PSQL="$(brew --prefix libpq)/bin/psql" \
  node gdq/scripts/sync-zurich-trees.mjs \
    --write --replace --batch-size 5000 \
    --database-url postgresql://postgres:postgres@127.0.0.1:54322/postgres \
    --mapbox-geojson gdq/output/zurich-trees.geojson
```

`--replace` is intentionally limited to `localhost` / `127.0.0.1` Supabase
URLs. It refuses to run if local adoptions or waterings exist, and removes only
the current local `trees` rows before importing the validated Zurich dataset.

The optional Mapbox GeoJSON contains the same stable `id` value as the
Supabase rows, so it can be used as the canonical tree source for the later
tileset step.

## Local Mapbox tree artifact

`scripts/build-zurich-tree-tileset.mjs` creates the upstream-compatible
vector-tile input from the local database. In addition to the stable `id`, it
includes the existing frontend's `age`, rainfall/watering totals, adoption
state, and `district` properties. It creates a layer named `trees`.

```bash
GDQ_PSQL="$(brew --prefix libpq)/bin/psql" \
  node gdq/scripts/build-zurich-tree-tileset.mjs \
    --database-url postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

This writes ignored local artifacts below `gdq/output/`:

```text
zurich-trees-mapbox.geojson
zurich-trees.mbtiles
```

The MBTiles file is ready for Mapbox upload. Publishing it needs a Mapbox
account name, an upload/tilesets token, and a separate public token for the
frontend; no token is stored in this repository.

After creating `gdq/.venv` and installing `gdq/requirements.txt`, publish it
without saving the secret token in a file:

```bash
gdq/.venv/bin/python gdq/scripts/upload-mapbox-tileset.py \
  --username "$MAPBOX_USERNAME" \
  --token "$MAPBOX_UPLOAD_TOKEN" \
  --tileset-id gdq_trees \
  --mbtiles gdq/output/zurich-trees.mbtiles
```

Run the importer tests with:

```bash
node --test gdq/scripts/sync-zurich-trees.test.mjs
```

Source: [City of Zurich Baumkataster](https://data.stadt-zuerich.ch/dataset/geo_baumkataster)
(CC0, WGS84 GeoJSON service, weekly updates).

## Zurich fountains

`scripts/sync-zurich-fountains.mjs` turns the official City of Zurich fountain
WFS into the existing pump GeoJSON contract. It preserves the numeric source
`objectid` as `id`, translates `abgestellt` to the existing pump status, and
keeps the official source GUID in `gdq:source_id` for traceability.

The command is a dry run unless `--output` is given. Its inclusion policy is
deliberately explicit: it does not silently decide whether private or
deactivated fountains belong in the watering map.

```bash
node gdq/scripts/sync-zurich-fountains.mjs

# Preview the conservative candidate set; this only writes an ignored local artifact.
node gdq/scripts/sync-zurich-fountains.mjs \
  --only-public --exclude-deactivated \
  --output gdq/output/zurich-fountains.geojson
```

After the resulting counts and inclusion policy are approved, the next small
step is to upload that artifact to local Supabase Storage and point the local
frontend launcher at its public local URL.

The localhost-only uploader refuses any remote Supabase URL. Supply the local
service-role token only through the process environment:

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY="$LOCAL_SERVICE_ROLE_KEY" \
  node gdq/scripts/upload-local-supabase-storage.mjs \
    --object zurich-fountains.geojson \
    --file gdq/output/zurich-fountains.geojson
```

Run the adapter tests with:

```bash
node --test gdq/scripts/sync-zurich-fountains.test.mjs
node --test gdq/scripts/upload-local-supabase-storage.test.mjs
```

Source: [City of Zurich fountains](https://data.stadt-zuerich.ch/dataset/geo_brunnen)
(CC0, WGS84 GeoJSON service, daily updates).
