#!/usr/bin/env python3
"""Generate a manifest for GitHub-style running heatmap SVG files."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path


YEAR_PATTERN = re.compile(r"^github_(\d{4})\.svg$")


def to_iso8601_utc(dt: datetime) -> str:
    return (
        dt.astimezone(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate manifest for github*.svg heatmap files."
    )
    parser.add_argument(
        "--assets-dir",
        default="assets",
        help='Directory containing github.svg and github_YYYY.svg (default: "assets").',
    )
    parser.add_argument(
        "--output",
        default="assets/github_manifest.json",
        help='Manifest output path (default: "assets/github_manifest.json").',
    )
    parser.add_argument(
        "--base-url",
        default="",
        help="Optional absolute base URL for generating direct file URLs.",
    )
    args = parser.parse_args()

    assets_dir = Path(args.assets_dir)
    if not assets_dir.exists():
        raise FileNotFoundError(f"assets directory does not exist: {assets_dir}")

    base_svg = assets_dir / "github.svg"
    if not base_svg.exists():
        raise FileNotFoundError(f"missing required file: {base_svg}")

    year_to_file: dict[str, str] = {}
    latest_mtime = base_svg.stat().st_mtime

    for svg in assets_dir.glob("github_*.svg"):
        match = YEAR_PATTERN.match(svg.name)
        if not match:
            continue
        year_to_file[match.group(1)] = svg.name
        latest_mtime = max(latest_mtime, svg.stat().st_mtime)

    years = sorted(year_to_file.keys(), key=int, reverse=True)
    files: dict[str, str] = {"Total": base_svg.name}
    for year in years:
        files[year] = year_to_file[year]

    now_year = str(datetime.now().year)
    if now_year in files:
        default_year = now_year
    elif years:
        default_year = years[0]
    else:
        default_year = "Total"

    updated_at_dt = datetime.fromtimestamp(latest_mtime, tz=timezone.utc)
    manifest = {
        "schema_version": 1,
        "updated_at": to_iso8601_utc(updated_at_dt),
        "version": updated_at_dt.strftime("%Y%m%d%H%M%S"),
        "default_year": default_year,
        "years": ["Total", *years],
        "files": files,
    }

    base_url = args.base_url.rstrip("/")
    if base_url:
        manifest["urls"] = {
            year: f"{base_url}/{filename}" for year, filename in files.items()
        }

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"manifest written: {output}")


if __name__ == "__main__":
    main()
