import assert from "node:assert/strict";
import test from "node:test";
import { toFeatureCollection } from "./build-zurich-tree-tileset.mjs";

test("preserves the stable tree ID and Mapbox style properties from PostgreSQL rows", () => {
	const collection = toFeatureCollection([
		'{"type":"Feature","properties":{"id":"zh-42","age":12,"watering_sum":0,"total_water_sum_liters":3.5,"is_adopted_by_users":"False","district":"Rathaus"},"geometry":{"type":"Point","coordinates":[8.5417,47.3769]}}',
	]);
	assert.equal(collection.features.length, 1);
	assert.equal(collection.features[0].properties.id, "zh-42");
	assert.equal(collection.features[0].properties.age, 12);
	assert.deepEqual(collection.features[0].geometry.coordinates, [8.5417, 47.3769]);
});
