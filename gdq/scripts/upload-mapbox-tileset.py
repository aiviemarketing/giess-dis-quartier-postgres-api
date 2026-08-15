#!/usr/bin/env python3

"""Upload a pre-built MBTiles artifact through the Mapbox Uploads API."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import boto3
import requests


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username", required=True)
    parser.add_argument("--token", required=True, help="Mapbox secret upload token")
    parser.add_argument("--tileset-id", required=True)
    parser.add_argument("--mbtiles", required=True, type=Path)
    parser.add_argument("--poll-seconds", type=float, default=2)
    parser.add_argument("--result-json", type=Path)
    return parser.parse_args()


def request(method: str, url: str, *, token: str, **kwargs: object) -> requests.Response:
    response = requests.request(method, url, params={"access_token": token}, timeout=60, **kwargs)
    if not response.ok:
        raise SystemExit(f"Mapbox {method} request failed with HTTP {response.status_code}: {response.text[:500]}")
    return response


def main() -> None:
    args = parse_args()
    if not args.mbtiles.is_file():
        raise SystemExit(f"MBTiles file does not exist: {args.mbtiles}")
    if not args.token.startswith("sk."):
        raise SystemExit("The upload token must be a Mapbox secret token (sk…)")

    base_url = f"https://api.mapbox.com/uploads/v1/{args.username}"
    credentials = request("POST", f"{base_url}/credentials", token=args.token).json()
    boto3.client(
        "s3",
        aws_access_key_id=credentials["accessKeyId"],
        aws_secret_access_key=credentials["secretAccessKey"],
        aws_session_token=credentials["sessionToken"],
    ).upload_file(str(args.mbtiles), credentials["bucket"], credentials["key"])

    tileset = f"{args.username}.{args.tileset_id}"
    upload = request(
        "POST",
        base_url,
        token=args.token,
        json={
            "url": f"http://{credentials['bucket']}.s3.amazonaws.com/{credentials['key']}",
            "tileset": tileset,
            "name": args.tileset_id,
        },
    ).json()
    upload_id = upload["id"]

    while True:
        status = request("GET", f"{base_url}/{upload_id}", token=args.token).json()
        if status.get("error"):
            raise SystemExit(f"Mapbox tileset creation failed: {status['error']}")
        if status.get("complete"):
            result = {"tilesetUrl": f"mapbox://{tileset}", "uploadId": upload_id}
            if args.result_json:
                args.result_json.parent.mkdir(parents=True, exist_ok=True)
                args.result_json.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(result, indent=2))
            return
        time.sleep(args.poll_seconds)


if __name__ == "__main__":
    main()
