#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const assertLocalDatabase = (databaseUrl) => {
	const host = new URL(databaseUrl).hostname;
	if (!LOCAL_DATABASE_HOSTS.has(host)) {
		throw new Error("--database-url is restricted to a local PostgreSQL URL");
	}
};

const run = async (executable, args, input) => {
	const child = spawn(executable, args, { stdio: ["pipe", "pipe", "pipe"] });
	let stdout = "";
	let stderr = "";
	child.stdout.on("data", (chunk) => {
		stdout += chunk;
	});
	child.stderr.on("data", (chunk) => {
		stderr += chunk;
	});
	child.stdin.end(input);

	const code = await new Promise((resolvePromise, reject) => {
		child.once("error", reject);
		child.once("close", resolvePromise);
	});
	if (code !== 0) throw new Error(`${executable} failed: ${stderr.trim() || `exit ${code}`}`);
	return { stdout, stderr };
};

const treeFeaturesQuery = `
SELECT json_build_object(
  'type', 'Feature',
  'properties', json_build_object(
    'id', trees.id,
    'radolan_sum', COALESCE(trees.radolan_sum, 0),
    'age', CASE
      WHEN trees.pflanzjahr IS NULL OR trees.pflanzjahr = 0 THEN to_json(''::text)
      ELSE to_json(EXTRACT(YEAR FROM CURRENT_DATE)::integer - trees.pflanzjahr)
    END,
    'watering_sum', COALESCE(watering.watering_sum, 0),
    'total_water_sum_liters', COALESCE(trees.radolan_sum, 0) / 10.0 + COALESCE(watering.watering_sum, 0),
    'is_adopted_by_users', CASE WHEN adoption.is_adopted THEN 'True' ELSE 'False' END,
    'district', trees.bezirk
  ),
  'geometry', ST_AsGeoJSON(trees.geom)::json
)::text
FROM public.trees
LEFT JOIN LATERAL (
  SELECT SUM(amount) AS watering_sum
  FROM public.trees_watered
  WHERE tree_id = trees.id
    AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
    AND DATE_TRUNC('day', timestamp) < CURRENT_DATE
) watering ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) > 0 AS is_adopted
  FROM public.trees_adopted
  WHERE tree_id = trees.id
) adoption ON true
WHERE trees.geom IS NOT NULL
ORDER BY trees.id;
`;

export const toFeatureCollection = (featureLines) => ({
	type: "FeatureCollection",
	features: featureLines.filter(Boolean).map((line) => JSON.parse(line)),
});

const parseArgs = (args) => {
	const options = {
		databaseUrl: null,
		geoJson: "gdq/output/zurich-trees-mapbox.geojson",
		mbtiles: "gdq/output/zurich-trees.mbtiles",
	};
	for (let index = 0; index < args.length; index += 1) {
		const value = args[index];
		if (value === "--database-url") options.databaseUrl = args[++index];
		else if (value === "--geojson") options.geoJson = args[++index];
		else if (value === "--mbtiles") options.mbtiles = args[++index];
		else throw new Error(`Unknown option: ${value}`);
	}
	if (!options.databaseUrl) throw new Error("--database-url is required");
	return options;
};

export const main = async (args = process.argv.slice(2)) => {
	const options = parseArgs(args);
	assertLocalDatabase(options.databaseUrl);

	const psql = process.env.GDQ_PSQL ?? "psql";
	const { stdout } = await run(psql, ["--no-psqlrc", "--tuples-only", "--no-align", "--quiet", "--dbname", options.databaseUrl, "--command", treeFeaturesQuery]);
	const geoJson = toFeatureCollection(stdout.split("\n"));
	if (geoJson.features.length === 0) throw new Error("No tree features were returned from the local database");
	if (geoJson.features.some((feature) => !feature.properties.id || feature.geometry?.type !== "Point")) {
		throw new Error("Local tree data does not satisfy the Mapbox point and stable-ID contract");
	}

	const geoJsonPath = resolve(options.geoJson);
	const mbtilesPath = resolve(options.mbtiles);
	await mkdir(dirname(geoJsonPath), { recursive: true });
	await mkdir(dirname(mbtilesPath), { recursive: true });
	await writeFile(geoJsonPath, `${JSON.stringify(geoJson)}\n`, "utf8");
	await run("tippecanoe", ["-zg", "-l", "trees", "-o", mbtilesPath, "--force", "--drop-fraction-as-needed", geoJsonPath]);

	const coordinates = geoJson.features.map((feature) => feature.geometry.coordinates);
	const boundingBox = [
		Math.min(...coordinates.map(([longitude]) => longitude)),
		Math.min(...coordinates.map(([, latitude]) => latitude)),
		Math.max(...coordinates.map(([longitude]) => longitude)),
		Math.max(...coordinates.map(([, latitude]) => latitude)),
	];
	console.log(
		JSON.stringify(
			{
				features: geoJson.features.length,
				layer: "trees",
				mbtiles: options.mbtiles,
				geoJson: options.geoJson,
				boundingBox: boundingBox.join(","),
			},
			null,
		),
	);
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
