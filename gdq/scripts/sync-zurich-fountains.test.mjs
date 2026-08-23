import assert from "node:assert/strict";
import test from "node:test";
import { prepareFountains } from "./sync-zurich-fountains.mjs";

const feature = (overrides = {}) => ({
	type: "Feature",
	geometry: { type: "Point", coordinates: [8.5417, 47.3769] },
	properties: {
		objectid: 42,
		art: "öffentlich",
		abgestellt: "nein",
		standort: "Limmatquai 1",
		ortsbezeichnung: "Rathausbrücke",
		datum_aenderung: "202608142235",
		u_aks_nummer: "{source-guid}",
		brunnennummer: "110",
		wasserart: "Quellwasser",
		brunnenart: "Trinkbrunnen",
		stadtkreis: 1,
		quartier: "Rathaus",
		...overrides,
	},
});

test("maps the official Zurich fountain data to the existing pump contract", () => {
	const prepared = prepareFountains({ type: "FeatureCollection", features: [feature()] });
	assert.equal(prepared.summary.validFountains, 1);
	assert.deepEqual(prepared.geoJson.features[0], {
		type: "Feature",
		properties: {
			id: 42,
			"pump:status": "funktionsfähig",
			"addr:full": "Limmatquai 1 — Rathausbrücke",
			check_date: "2026-08-14",
			"gdq:source_id": "{source-guid}",
			"gdq:fountain_number": "110",
			"gdq:public": true,
			"gdq:deactivated": false,
			"gdq:deactivation_reason": null,
			"gdq:water_type": "Quellwasser",
			"gdq:fountain_type": "Trinkbrunnen",
			"gdq:district": "1",
			"gdq:quarter": "Rathaus",
		},
		geometry: { type: "Point", coordinates: [8.5417, 47.3769] },
	});
});

test("keeps the inclusion policy explicit", () => {
	const prepared = prepareFountains(
		{ type: "FeatureCollection", features: [feature(), feature({ objectid: 43, art: "privat" }), feature({ objectid: 44, abgestellt: "ja" })] },
		{ onlyPublic: true, excludeDeactivated: true },
	);
	assert.equal(prepared.summary.validFountains, 3);
	assert.equal(prepared.summary.selectedFountains, 1);
	assert.deepEqual(prepared.summary.filter, { onlyPublic: true, excludeDeactivated: true });
});

test("rejects malformed or duplicate numeric source IDs", () => {
	const malformed = feature({ objectid: null });
	malformed.geometry = { type: "Point", coordinates: [8.5, 100] };
	const prepared = prepareFountains({ type: "FeatureCollection", features: [feature(), feature(), malformed] });
	assert.equal(prepared.summary.selectedFountains, 0);
	assert.deepEqual(prepared.duplicateIds, [42]);
	assert.equal(prepared.summary.missingOrInvalidIds, 1);
	assert.equal(prepared.summary.invalidGeometries, 1);
});
