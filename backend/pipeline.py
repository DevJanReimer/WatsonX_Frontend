"""
pipeline.py — simple end-to-end ingestion runner using the current
`ingest` and `chunker.process_json` APIs.

This script will:
  - Walk a folder for supported documents
  - Run `ingest()` to produce a _data.json per file in a temp work dir
  - Call `chunker.process_json()` to chunk and push data to Astra DB

It avoids depending on older/renamed helper symbols and keeps the
implementation minimal so it remains easy to call from CI or local
machines. Collections are created if missing; use `--dry-run` to preview.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from dotenv import load_dotenv

from ingestion import ingest
from chunker import (
    DEFAULT_MAX_CHARS,
    get_or_create_collections,
    process_json,
)

SUPPORTED_EXTENSIONS = {".docx", ".doc", ".pdf", ".doc"}


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", help="Folder containing documents to ingest")
    parser.add_argument("--no-vision", action="store_true", help="Skip VLM image description pass")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to Astra DB")
    parser.add_argument("--max-chars", type=int, default=DEFAULT_MAX_CHARS,
                        help=f"Max chars per chunk (default: {DEFAULT_MAX_CHARS})")
    args = parser.parse_args()

    folder = Path(args.folder)
    if not folder.is_dir():
        print(f"[error] Not a directory: {folder}")
        return 2

    files = sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS)
    if not files:
        print(f"[error] No supported files found in {folder}")
        return 1

    print(f"[pipeline] {len(files)} file(s) found in {folder}")

    # Connect to Astra unless dry-run
    collections = None
    if not args.dry_run:
        from astrapy import DataAPIClient
        import os

        token = os.environ.get("ASTRA_DB_APPLICATION_TOKEN")
        endpoint = os.environ.get("ASTRA_DB_API_ENDPOINT")
        if not token or not endpoint:
            print("[error] ASTRA_DB_APPLICATION_TOKEN or ASTRA_DB_API_ENDPOINT not set")
            return 3
        client = DataAPIClient(token)
        database = client.get_database(endpoint)
        collections = get_or_create_collections(database)

    failures = []
    totals = {"chunks": 0, "tables": 0, "images": 0}

    for i, f in enumerate(files, 1):
        print(f"\n[{i}/{len(files)}] {f.name}")
        work_root = Path.cwd() / f"tmp_pipeline_{f.stem}"
        if work_root.exists():
            shutil.rmtree(work_root, ignore_errors=True)
        try:
            result = ingest(str(f), run_vision=not args.no_vision, work_dir=work_root)
            data_json = Path(result["work_dir"]) / f"{f.stem}_data.json"
            counts = process_json(json_path=data_json, collections=collections, max_chars=args.max_chars, dry_run=args.dry_run)
            for k in totals:
                totals[k] += counts.get(k, 0)
        except Exception as e:
            print(f"  [FAIL] {e}")
            failures.append((f.name, str(e)))
        finally:
            shutil.rmtree(work_root, ignore_errors=True)

    print("\n[done] Summary:")
    print(f"  chunks : {totals['chunks']}")
    print(f"  tables : {totals['tables']}")
    print(f"  images : {totals['images']}")
    if failures:
        print(f"  failures: {len(failures)}")
        for name, err in failures:
            print(f"    - {name}: {err}")

    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
