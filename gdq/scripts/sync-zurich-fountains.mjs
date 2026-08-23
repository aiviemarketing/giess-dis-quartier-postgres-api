#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_SOURCE_URL =
	"https://www.ogd.stadt-zuerich.ch/wfs/geoportal/Brunnen?service=WFS&version=1.1.0&request=GetFeature&typeName=wvz_brunnen&outputFormat=application/json&srsName=EPSG:4326";

const stringValue = (value) => {
	if (typeof value !== "string" && typeof value !== "number") return null;
	const normalized = String(value).trim();
	return normalized.length > 0 ? normalized : null;
};

const pointCoordinates = (geometry) => {
	if (!geometry || geometry.type !== "Point" || !Array.isArray(geometry.coordinates)) return null;
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
	return { longitude, latitude };
};

const booleanYes = (value) => stringValue(value)?.toLocaleLowerCase("de-CH") === "ja";

const dateOnly = (value) => {
	const date = stringValue(value);
	if (!date) return null;
	const match = /^(\d{4})(\d{2})(\d{2})/.exec(date);
	return match ? `${match[1]}-${match[2]}-${match[3]}` : date.slice(0, 10);
};

const address = (properties) => {
	const values = [stringValue(properties.standort), stringValue(properties.ortsbezeichnung)].filter(Boolean);
	return values.length > 0 ? values.join(" — ") : stringValue(properties.brunnennummer);
};

export const normalizeFeature = (feature) => {
	const properties = feature?.properties ?? {};
	const id = Number(properties.objectid);
	const coordinates = pointCoordinates(feature?.geometry);
	const publicFountain = stringValue(properties.art)?.toLocaleLowerCase("de-CH") === "öffentlich";
	const deactivated = booleanYes(properties.abgestellt);
	const errors = [];
	if (!Number.isSafeInteger(id) || id < 1) errors.push("missing_or_invalid_objectid");
	if (!coordinates) errors.push("invalid_geometry");

	return {
		id: Number.isSafeInteger(id) ? id : null,
		errors,
		publicFountain,
		deactivated,
		feature:
			errors.length === 0
				? {
					type: "Feature",
					properties: {
						id,
						"pump:status": deactivated ? "defekt" : "funktionsfähig",
						"addr:full": address(properties),
						check_date: dateOnly(properties.datum_aenderung),
						"gdq:source_id": stringValue(properties.u_aks_nummer),
						"gdq:fountain_number": stringValue(properties.brunnennummer),
						"gdq:public": publicFountain,
						"gdq:deactivated": deactivated,
						"gdq:deactivation_reason": stringValue(properties.grund_abstellung),
						"gdq:water_type": stringValue(properties.wasserart),
						"gdq:fountain_type": stringValue(properties.brunnenart),
						"gdq:district": stringValue(properties.stadtkreis),
						"gdq:quarter": stringValue(properties.quartier),
					},
					geometry: { type: "Point", coordinates: [coordinates.longitude, coordinates.latitude] },
				}
				: null,
	};
};

const countBy = (items, property) =>
	items.reduce((counts, item) => {
		const value = item.feature?.properties[property] ?? "(missing)";
		counts[value] = (counts[value] ?? 0) + 1;
		return counts;
	}, {});

export const prepareFountains = (featureCollection, { onlyPublic = false, excludeDeactivated = false } = {}) => {
	if (featureCollection?.type !== "FeatureCollection" || !Array.isArray(featureCollection.features)) {
		throw new Error("Expected a GeoJSON FeatureCollection with a features array");
	}

	const normalized = featureCollection.features.map(normalizeFeature);
	const idCounts = new Map();
	for (const item of normalized) {
		if (item.id !== null) idCounts.set(item.id, (idCounts.get(item.id) ?? 0) + 1);
	}
	const duplicateIds = [...idCounts]
		.filter(([, count]) => count > 1)
		.map(([id]) => id)
		.sort((left, right) => left - right);
	const duplicateSet = new Set(duplicateIds);
	const valid = normalized.filter((item) => item.feature && !duplicateSet.has(item.id));
	const selected = valid.filter(
		(item) => (!onlyPublic || item.publicFountain) && (!excludeDeactivated || !item.deactivated),
	);

	return {
		geoJson: { type: "FeatureCollection", features: selected.map((item) => item.feature) },
		summary: {
			totalSourceRows: featureCollection.features.length,
			validFountains: valid.length,
			selectedFountains: selected.length,
			missingOrInvalidIds: normalized.filter((item) => item.errors.includes("missing_or_invalid_objectid")).length,
			duplicateIds: duplicateIds.length,
			invalidGeometries: normalized.filter((item) => item.errors.includes("invalid_geometry")).length,
			publicFountains: valid.filter((item) => item.publicFountain).length,
			deactivatedFountains: valid.filter((item) => item.deactivated).length,
			filter: { onlyPublic, excludeDeactivated },
			waterTypes: countBy(valid, "gdq:water_type"),
			fountainTypes: countBy(valid, "gdq:fountain_type"),
		},
		duplicateIds,
	};
};

const parseArgs = (args) => {
	const options = { sourceUrl: DEFAULT_SOURCE_URL, input: null, output: null, onlyPublic: false, excludeDeactivated: false };
	for (let index = 0; index < args.length; index += 1) {
		const value = args[index];
		if (value === "--source-url") options.sourceUrl = args[++index];
		else if (value === "--input") options.input = args[++index];
		else if (value === "--output") options.output = args[++index];
		else if (value === "--only-public") options.onlyPublic = true;
		else if (value === "--exclude-deactivated") options.excludeDeactivated = true;
		else throw new Error(`Unknown option: ${value}`);
	}
	return options;
};

const loadSource = async (options) => {
	if (options.input) return JSON.parse(await readFile(options.input, "utf8"));
	const response = await fetch(options.sourceUrl);
	if (!response.ok) throw new Error(`Zurich fountain source request failed: ${response.status} ${response.statusText}`);
	return response.json();
};

export const main = async (args = process.argv.slice(2)) => {
	const options = parseArgs(args);
	const prepared = prepareFountains(await loadSource(options), options);
	if (prepared.summary.missingOrInvalidIds > 0 || prepared.summary.duplicateIds > 0 || prepared.summary.invalidGeometries > 0) {
		throw new Error(`Source validation failed: ${JSON.stringify(prepared.summary)}`);
	}
	if (options.output) {
		const outputPath = resolve(options.output);
		await mkdir(dirname(outputPath), { recursive: true });
		await writeFile(outputPath, `${JSON.stringify(prepared.geoJson)}\n`, "utf8");
	}
	console.log(JSON.stringify({ mode: options.output ? "export" : "dry-run", output: options.output, ...prepared.summary }, null, 2));
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
