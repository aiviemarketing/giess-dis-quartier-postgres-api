![love badge](https://img.shields.io/badge/Built%20with-%E2%99%A5-red)

# Güss dis Quartier API

Local Supabase API, database schema, and Zurich data adapters for the Giess dis
Quartier MVP. The frontend, this API, and the weather tooling form one local
development stack.

## About

This Aivie fork provides the API layer for Güss dis Quartier. In deployment, it connects the application to Aivie's PostgreSQL database.
Learn more at [aivie.ch](https://aivie.ch).

## Local development

Install the Node dependencies and start local Supabase:

```bash
git clone https://github.com/aiviemarketing/guess-dis-quartier-postgres-api.git
cd guess-dis-quartier-postgres-api
source /Users/Adrian/.nvm/nvm.sh
nvm use
npm ci
npx supabase start
```

The local stack provides Postgres at
`postgresql://postgres:postgres@localhost:54322/postgres`, the API at
`http://localhost:54321`, and Supabase Studio at `http://localhost:54323`.
Run `npx supabase status` to see the local API keys and connection details.

For local function development, create `supabase/.env` from the supplied sample
file and run:

```bash
supabase functions serve --no-verify-jwt --env-file supabase/.env
```

## Zurich data adapters

The Zurich-specific tools live in [gdq/README.md](gdq/README.md):

- tree synchronisation and safe local replacement;
- fountain generation and local Storage upload; and
- Mapbox tree-tile artifact generation and publication.

The active MeteoSwiss CPC rain importer lives with the frontend. Follow the
[CPC integration guide](https://github.com/aiviemarketing/guess-dis-quartier/blob/main/gdq/cpc/README.md)
to import and aggregate local rain data.

## Database workflow

Create schema migrations from intentional local database changes, then
regenerate the TypeScript types:

```bash
supabase db diff --file <migration-name> --schema public --use-migra
supabase gen types typescript --local > _types/database.ts
```

Keep database changes explicit. Do not point local tooling at a remote database
or reuse production credentials.

## Tests

With local Supabase running and the required `.env` values configured:

```bash
npm test
```

To run the Edge Function tests locally:

```bash
docker run -p 1025:1025 mailhog/mailhog
npx supabase start
supabase functions serve --no-verify-jwt --env-file supabase/.env.test
deno test --allow-all supabase/functions/tests/submit-contact-request-tests.ts --env=supabase/.env.test
```

## Database caveats

The project uses materialized views for several application statistics. For a
large local restore, disable the tree-statistic triggers before the restore,
then refresh the views and re-enable the triggers:

```sql
ALTER TABLE trees DISABLE TRIGGER tg_refresh_trees_count_mv;
ALTER TABLE trees DISABLE TRIGGER tg_refresh_most_frequent_tree_species_mv;
ALTER TABLE trees DISABLE TRIGGER tg_refresh_total_tree_species_count_mv;

REFRESH MATERIALIZED VIEW CONCURRENTLY total_tree_species_count;
REFRESH MATERIALIZED VIEW CONCURRENTLY most_frequent_tree_species;
REFRESH MATERIALIZED VIEW CONCURRENTLY trees_count;

ALTER TABLE trees ENABLE TRIGGER tg_refresh_trees_count_mv;
ALTER TABLE trees ENABLE TRIGGER tg_refresh_most_frequent_tree_species_mv;
ALTER TABLE trees ENABLE TRIGGER tg_refresh_total_tree_species_count_mv;
```

## Contributors

- [Adrian Schimpf (`adiux`)](https://github.com/adiux) — Güss dis Quartier adaptation.

## Acknowledgements

Thanks to the upstream contributors who made Giess den Kiez possible:
https://github.com/technologiestiftung/giessdenkiez-de#contributors-

## MVP sponsor

<a href="https://aivie.ch/">
  <img src="https://cdn.aivie.ch/media/wp/2021/06/19131704/logo-aivie-fast-kein-rand-400w.png" alt="Aivie" width="180" />
</a>

This Zürich MVP is sponsored by [Aivie](https://aivie.ch/?utm_source=github&utm_medium=gdq&utm_campaign=expert&utm_content=readme-gdq).
