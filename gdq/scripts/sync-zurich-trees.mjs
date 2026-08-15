#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_SOURCE_URL =
	"https://www.ogd.stadt-zuerich.ch/wfs/geoportal/Baumkataster?service=WFS&version=1.1.0&request=GetFeature&typeName=baumkataster_baumstandorte&outputFormat=application/json&srsName=EPSG:4326";

const LOCAL_SUPABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const TREE_COLUMNS = [
	"id",
	"lat",
	"lng",
	"art_dtsch",
	"art_bot",
	"gattung",
	"gattung_deutsch",
	"pflanzjahr",
	"bezirk",
	"strname",
	"type",
	"kronedurch",
	"standortnr",
	"geom",
];
const TREE_STATS_TRIGGERS = [
	"tg_refresh_most_frequent_tree_species_mv",
	"tg_refresh_total_tree_species_count_mv",
	"tg_refresh_trees_count_mv",
];
const TREE_STATS_VIEWS = ["most_frequent_tree_species", "total_tree_species_count", "trees_count"];

const stringValue = (value) => {
	if (typeof value !== "string" && typeof value !== "number") {
		return null;
	}
	const normalized = String(value).trim();
	return normalized.length > 0 ? normalized : null;
};

const normalizeYear = (value) => {
	const parsed = Number.parseInt(String(value), 10);
	return Number.isInteger(parsed) && parsed >= 1000 && parsed <= 3000
		? parsed
		: null;
};

const germanGenus = (germanName) => {
	if (!germanName) {
		return null;
	}

	// The source has a German species name but no separate German genus field.
	// Its leading term is the closest upstream-compatible genus label.
	return germanName.split(/[,-]/, 1)[0].trim() || null;
};

const pointCoordinates = (geometry) => {
	if (!geometry || geometry.type !== "Point" || !Array.isArray(geometry.coordinates)) {
		return null;
	}

	const [longitude, latitude] = geometry.coordinates;
	if (
		typeof longitude !== "number" ||
		typeof latitude !== "number" ||
		!Number.isFinite(longitude) ||
		!Number.isFinite(latitude) ||
		longitude < -180 ||
		longitude > 180 ||
		latitude < -90 ||
		latitude > 90
	) {
		return null;
	}

	return { latitude, longitude };
};

export const normalizeFeature = (feature) => {
	const properties = feature?.properties ?? {};
	const id = stringValue(properties.baumnummer);
	const coordinates = pointCoordinates(feature?.geometry);
	const germanName = stringValue(properties.baumnamedeu);
	const botanicalName = stringValue(properties.baumnamelat);
	const genus = stringValue(properties.baumgattunglat);
	const plantingYear = normalizeYear(properties.pflanzjahr);

	const errors = [];
	if (!id) errors.push("missing_id");
	if (!coordinates) errors.push("invalid_geometry");

	return {
		id,
		errors,
		missingSpecies: !germanName && !botanicalName,
		missingPlantingYear: plantingYear === null,
		row:
			id && coordinates
				? {
						id,
						lat: String(coordinates.latitude),
						lng: String(coordinates.longitude),
						art_dtsch: germanName,
						art_bot: botanicalName,
						gattung: genus,
						gattung_deutsch: germanGenus(germanName),
						pflanzjahr: plantingYear,
						bezirk: stringValue(properties.quartier),
						strname: stringValue(properties.strasse),
						type: stringValue(properties.kategorie) ?? stringValue(properties.baumtyptext),
						kronedurch: stringValue(properties.kronendurchmesser),
						standortnr: id,
						geom: `SRID=4326;POINT(${coordinates.longitude} ${coordinates.latitude})`,
					}
				: null,
	};
};

export const prepareImport = (featureCollection) => {
	if (featureCollection?.type !== "FeatureCollection" || !Array.isArray(featureCollection.features)) {
		throw new Error("Expected a GeoJSON FeatureCollection with a features array");
	}

	const normalized = featureCollection.features.map(normalizeFeature);
	const idCounts = new Map();
	for (const item of normalized) {
		if (item.id) idCounts.set(item.id, (idCounts.get(item.id) ?? 0) + 1);
	}

	const duplicateIds = [...idCounts]
		.filter(([, count]) => count > 1)
		.map(([id]) => id)
		.sort();
	const duplicateSet = new Set(duplicateIds);
	const rows = normalized
		.filter((item) => item.row && item.errors.length === 0 && !duplicateSet.has(item.id))
		.map((item) => item.row);

	return {
		rows,
		summary: {
			totalSourceRows: featureCollection.features.length,
			validTrees: rows.length,
			missingIds: normalized.filter((item) => item.errors.includes("missing_id")).length,
			duplicateIds: duplicateIds.length,
			invalidGeometries: normalized.filter((item) => item.errors.includes("invalid_geometry")).length,
			missingSpecies: normalized.filter((item) => item.missingSpecies).length,
			missingPlantingYears: normalized.filter((item) => item.missingPlantingYear).length,
		},
		duplicateIds,
	};
};

export const toMapboxGeoJson = (rows) => ({
	type: "FeatureCollection",
	features: rows.map((row) => ({
		type: "Feature",
		properties: {
			id: row.id,
			art_dtsch: row.art_dtsch,
			art_bot: row.art_bot,
			gattung: row.gattung,
			gattung_deutsch: row.gattung_deutsch,
			pflanzjahr: row.pflanzjahr,
			bezirk: row.bezirk,
		},
		geometry: {
			type: "Point",
			coordinates: [Number(row.lng), Number(row.lat)],
		},
	})),
});

const chunks = (items, size) => {
	const result = [];
	for (let index = 0; index < items.length; index += size) {
		result.push(items.slice(index, index + size));
	}
	return result;
};

const assertLocalSupabase = (supabaseUrl) => {
	const host = new URL(supabaseUrl).hostname;
	if (!LOCAL_SUPABASE_HOSTS.has(host)) {
		throw new Error("--replace is restricted to a local Supabase URL");
	}
};

const assertLocalDatabase = (databaseUrl) => {
	const host = new URL(databaseUrl).hostname;
	if (!LOCAL_SUPABASE_HOSTS.has(host)) {
		throw new Error("--database-url is restricted to a local PostgreSQL URL");
	}
};

const toCopyValue = (value) => {
	if (value === null || value === undefined) return "\\N";
	return `"${String(value).replaceAll('"', '""')}"`;
};

export const toPostgresCopy = (rows) =>
	rows.map((row) => TREE_COLUMNS.map((column) => toCopyValue(row[column])).join(",")).join("\n");

const runPsql = async ({ databaseUrl, input, command }) => {
	const executable = process.env.GDQ_PSQL ?? "psql";
	const args = ["--no-psqlrc", "--set=ON_ERROR_STOP=1", "--dbname", databaseUrl];
	if (command) args.push("--command", command);

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
	if (code !== 0) throw new Error(`Local PostgreSQL import failed: ${stderr.trim() || `psql exited ${code}`}`);
	return stdout;
};

const replaceLocalTreesViaPostgres = async ({ rows, databaseUrl }) => {
	assertLocalDatabase(databaseUrl);
	const references = await runPsql({
		databaseUrl,
		command:
			"SELECT (SELECT count(*) FROM public.trees_adopted), (SELECT count(*) FROM public.trees_watered);",
	});
	const [adoptions, waterings] = references.trim().split("|").map(Number);
	if (adoptions > 0 || waterings > 0) {
		throw new Error(
			`Refusing to replace trees while local references exist (adoptions: ${adoptions}, waterings: ${waterings})`,
		);
	}

	const disableTriggers = TREE_STATS_TRIGGERS.map(
		(trigger) => `ALTER TABLE public.trees DISABLE TRIGGER ${trigger};`,
	).join("\n");
	const enableTriggers = TREE_STATS_TRIGGERS.map(
		(trigger) => `ALTER TABLE public.trees ENABLE TRIGGER ${trigger};`,
	).join("\n");
	const refreshViews = TREE_STATS_VIEWS.map(
		(view) => `REFRESH MATERIALIZED VIEW public.${view};`,
	).join("\n");
	const copyData = toPostgresCopy(rows);
	await runPsql({
		databaseUrl,
		input: `BEGIN;\n${disableTriggers}\nDELETE FROM public.trees;\nCOPY public.trees (${TREE_COLUMNS.join(", ")}) FROM STDIN WITH (FORMAT csv, NULL '\\N');\n${copyData}\n\\.\n${enableTriggers}\nCOMMIT;\n${refreshViews}\n`,
	});
};

const countRows = async (client, table) => {
	const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
	if (error) throw new Error(`Could not count ${table}: ${error.message}`);
	return count ?? 0;
};

const replaceLocalTrees = async (client, supabaseUrl) => {
	assertLocalSupabase(supabaseUrl);
	const [adoptions, waterings] = await Promise.all([
		countRows(client, "trees_adopted"),
		countRows(client, "trees_watered"),
	]);
	if (adoptions > 0 || waterings > 0) {
		throw new Error(
			`Refusing to replace trees while local references exist (adoptions: ${adoptions}, waterings: ${waterings})`,
		);
	}

	const { error } = await client.from("trees").delete().not("id", "is", null);
	if (error) throw new Error(`Could not remove existing local trees: ${error.message}`);
};

const writeRows = async ({ rows, replace, batchSize, databaseUrl }) => {
	if (databaseUrl) {
		if (!replace) throw new Error("--database-url requires --replace");
		await replaceLocalTreesViaPostgres({ rows, databaseUrl });
		return;
	}

	const supabaseUrl = process.env.SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required with --write");
	}

	const client = createClient(supabaseUrl, serviceRoleKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
	if (replace) await replaceLocalTrees(client, supabaseUrl);

	for (const [index, batch] of chunks(rows, batchSize).entries()) {
		const { error } = await client.from("trees").upsert(batch, { onConflict: "id" });
		if (error) throw new Error(`Tree batch ${index + 1} failed: ${error.message}`);
		console.error(`Imported batch ${index + 1}/${Math.ceil(rows.length / batchSize)}`);
	}
};

const parseArgs = (args) => {
	const options = {
		sourceUrl: DEFAULT_SOURCE_URL,
		input: null,
		write: false,
		replace: false,
		batchSize: 5000,
		mapboxGeoJson: null,
		databaseUrl: null,
	};

	for (let index = 0; index < args.length; index += 1) {
		const value = args[index];
		if (value === "--write") options.write = true;
		else if (value === "--replace") options.replace = true;
		else if (value === "--source-url") options.sourceUrl = args[++index];
		else if (value === "--input") options.input = args[++index];
		else if (value === "--mapbox-geojson") options.mapboxGeoJson = args[++index];
		else if (value === "--batch-size") options.batchSize = Number.parseInt(args[++index], 10);
		else if (value === "--database-url") options.databaseUrl = args[++index];
		else throw new Error(`Unknown option: ${value}`);
	}

	if (!Number.isInteger(options.batchSize) || options.batchSize < 1) {
		throw new Error("--batch-size must be a positive integer");
	}
	return options;
};

const loadSource = async (options) => {
	if (options.input) return JSON.parse(await readFile(options.input, "utf8"));
	const response = await fetch(options.sourceUrl);
	if (!response.ok) throw new Error(`Zurich source request failed: ${response.status} ${response.statusText}`);
	return response.json();
};

export const main = async (args = process.argv.slice(2)) => {
	const options = parseArgs(args);
	const prepared = prepareImport(await loadSource(options));
	if (
		prepared.summary.missingIds > 0 ||
		prepared.summary.duplicateIds > 0 ||
		prepared.summary.invalidGeometries > 0
	) {
		throw new Error(`Source validation failed: ${JSON.stringify(prepared.summary)}`);
	}

	if (options.mapboxGeoJson) {
		const outputPath = resolve(options.mapboxGeoJson);
		await mkdir(dirname(outputPath), { recursive: true });
		await writeFile(outputPath, `${JSON.stringify(toMapboxGeoJson(prepared.rows))}\n`, "utf8");
	}
	if (options.write) {
		await writeRows({
			rows: prepared.rows,
			replace: options.replace,
			batchSize: options.batchSize,
			databaseUrl: options.databaseUrl,
		});
	}

	console.log(
		JSON.stringify(
			{
				mode: options.write ? "write" : "dry-run",
				replace: options.replace,
				...prepared.summary,
				mapboxGeoJson: options.mapboxGeoJson,
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
