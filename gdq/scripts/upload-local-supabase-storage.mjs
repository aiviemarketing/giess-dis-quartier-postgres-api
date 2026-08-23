#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const LOCAL_SUPABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export const assertLocalSupabase = (supabaseUrl) => {
	const host = new URL(supabaseUrl).hostname;
	if (!LOCAL_SUPABASE_HOSTS.has(host)) {
		throw new Error("Uploads are restricted to a local Supabase URL");
	}
};

export const objectUrl = ({ supabaseUrl, bucket, objectName }) =>
	new URL(`/storage/v1/object/${encodeURIComponent(bucket)}/${objectName.split("/").map(encodeURIComponent).join("/")}`, supabaseUrl).toString();

export const uploadObject = async ({ supabaseUrl, serviceRoleKey, bucket, objectName, body, fetchImpl = fetch }) => {
	assertLocalSupabase(supabaseUrl);
	const response = await fetchImpl(objectUrl({ supabaseUrl, bucket, objectName }), {
		method: "PUT",
		headers: {
			authorization: `Bearer ${serviceRoleKey}`,
			apikey: serviceRoleKey,
			"content-type": "application/geo+json",
			"x-upsert": "true",
		},
		body,
	});
	if (!response.ok) throw new Error(`Local Storage upload failed: ${response.status} ${await response.text()}`);
	return `${new URL(supabaseUrl).origin}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectName.split("/").map(encodeURIComponent).join("/")}`;
};

const parseArgs = (args) => {
	const options = { bucket: "data_assets", objectName: null, file: null };
	for (let index = 0; index < args.length; index += 1) {
		const value = args[index];
		if (value === "--bucket") options.bucket = args[++index];
		else if (value === "--object") options.objectName = args[++index];
		else if (value === "--file") options.file = args[++index];
		else throw new Error(`Unknown option: ${value}`);
	}
	if (!options.objectName || !options.file) throw new Error("--object and --file are required");
	return options;
};

export const main = async (args = process.argv.slice(2)) => {
	const { bucket, objectName, file } = parseArgs(args);
	const supabaseUrl = process.env.SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
	const publicUrl = await uploadObject({
		supabaseUrl,
		serviceRoleKey,
		bucket,
		objectName,
		body: await readFile(resolve(file)),
	});
	console.log(JSON.stringify({ bucket, objectName, publicUrl }, null, 2));
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
