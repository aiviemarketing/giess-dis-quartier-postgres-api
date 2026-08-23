import assert from "node:assert/strict";
import test from "node:test";
import { assertLocalSupabase, objectUrl, uploadObject } from "./upload-local-supabase-storage.mjs";

test("limits uploads to local Supabase", () => {
	assert.doesNotThrow(() => assertLocalSupabase("http://127.0.0.1:54321"));
	assert.throws(() => assertLocalSupabase("https://example.supabase.co"), /restricted to a local/);
});

test("uses a Storage object URL and upsert semantics", async () => {
	let request;
	const publicUrl = await uploadObject({
		supabaseUrl: "http://127.0.0.1:54321",
		serviceRoleKey: "test-key",
		bucket: "data_assets",
		objectName: "zurich/fountains.geojson",
		body: "{}",
		fetchImpl: async (url, init) => {
			request = { url, init };
			return new Response("{}", { status: 200 });
		},
	});
	assert.equal(request.url, objectUrl({ supabaseUrl: "http://127.0.0.1:54321", bucket: "data_assets", objectName: "zurich/fountains.geojson" }));
	assert.equal(request.init.headers["x-upsert"], "true");
	assert.equal(publicUrl, "http://127.0.0.1:54321/storage/v1/object/public/data_assets/zurich/fountains.geojson");
});
