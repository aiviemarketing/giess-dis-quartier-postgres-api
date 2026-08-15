import assert from "node:assert/strict";
import test from "node:test";
import { prepareImport, toMapboxGeoJson, toPostgresCopy } from "./sync-zurich-trees.mjs";

const feature = (overrides = {}) => ({
	type: "Feature",
	geometry: { type: "Point", coordinates: [8.5417, 47.3769] },
	properties: {
		baumnummer: "zh-42",
		baumnamedeu: "Winterlinde",
		baumnamelat: "Tilia cordata",
		baumgattunglat: "Tilia",
		pflanzjahr: 1998,
		quartier: "Rathaus",
		strasse: "Limmatquai",
		kategorie: "Strassenbaum",
		kronendurchmesser: 8,
		...overrides,
	},
});

test("maps a valid official feature to the existing trees contract", () => {
	const prepared = prepareImport({ type: "FeatureCollection", features: [feature()] });
	assert.deepEqual(prepared.summary, {
		totalSourceRows: 1,
		validTrees: 1,
		missingIds: 0,
		duplicateIds: 0,
		invalidGeometries: 0,
		missingSpecies: 0,
		missingPlantingYears: 0,
	});
	assert.deepEqual(prepared.rows[0], {
		id: "zh-42",
		lat: "47.3769",
		lng: "8.5417",
		art_dtsch: "Winterlinde",
		art_bot: "Tilia cordata",
		gattung: "Tilia",
		gattung_deutsch: "Winterlinde",
		pflanzjahr: 1998,
		bezirk: "Rathaus",
		strname: "Limmatquai",
		type: "Strassenbaum",
		kronedurch: "8",
		standortnr: "zh-42",
		geom: "SRID=4326;POINT(8.5417 47.3769)",
	});
});

test("rejects duplicate IDs and invalid geometries from the import rows", () => {
	const malformed = feature({ baumnummer: "" });
	malformed.geometry = { type: "Point", coordinates: [8.5, 100] };
	const prepared = prepareImport({
		type: "FeatureCollection",
		features: [feature(), feature(), malformed],
	});
	assert.equal(prepared.rows.length, 0);
	assert.deepEqual(prepared.duplicateIds, ["zh-42"]);
	assert.equal(prepared.summary.missingIds, 1);
	assert.equal(prepared.summary.invalidGeometries, 1);
});

test("keeps the stable database ID as the Mapbox feature ID property", () => {
	const prepared = prepareImport({ type: "FeatureCollection", features: [feature()] });
	const geoJson = toMapboxGeoJson(prepared.rows);
	assert.equal(geoJson.features[0].properties.id, "zh-42");
	assert.deepEqual(geoJson.features[0].geometry.coordinates, [8.5417, 47.3769]);
});

test("serializes nulls and quotes safely for the local PostgreSQL copy import", () => {
	const prepared = prepareImport({
		type: "FeatureCollection",
		features: [feature({ baumnamedeu: 'Eiche "Z\u00fcrich"', baumnamelat: null })],
	});
	const copy = toPostgresCopy(prepared.rows);
	assert.match(copy, /"Eiche ""Z\u00fcrich"""/);
	assert.match(copy, /\\N/);
});
