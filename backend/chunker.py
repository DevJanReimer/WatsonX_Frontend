"""
chunker.py — Chunk linear text and push everything to Astra DB.

Reads _data.json files produced by ingestion.py and:
  1. Chunks the linear text (heading-first, paragraph fallback, placeholder-safe)
  2. Inserts text chunks into  isdp_chunks  (hybrid search)
  3. Inserts table assets into isdp_tables  (vector search)
  4. Inserts image assets into isdp_images  (vector search, description only)

Usage:
    # Single file
    python chunker.py tmp/MyDoc/MyDoc_data.json

    # Whole tmp folder (processes every *_data.json found recursively)
    python chunker.py tmp/

    # Dry run — no Astra writes
    python chunker.py tmp/ --dry-run

    # Adjust chunk size
    python chunker.py tmp/ --max-chars 1200

Requirements in .env:
    ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from astrapy import DataAPIClient
from astrapy.info import (
    CollectionDefinition,
    CollectionLexicalOptions,
    CollectionRerankOptions,
    RerankServiceOptions,
)
from dotenv import load_dotenv
from pathlib import Path


# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

COLLECTION_CHUNKS = "isdp_chunks"
COLLECTION_TABLES = "isdp_tables"
COLLECTION_IMAGES = "isdp_images"

# NV-Embed-QA hard limit is 512 tokens.
# German ≈ 3.5 chars/token → 1400 chars ≈ 400 tokens (safe buffer).
DEFAULT_MAX_CHARS = 1400

PLACEHOLDER_RE = re.compile(r"\[\[(TABLE|IMAGE):([^\]]+)\]\]")
PAGE_RE = re.compile(r"\[\[PAGE:(\d+)\]\]")


# ─────────────────────────────────────────────────────────────────────────────
# Chunking
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RawChunk:
    text:         str
    heading_path: list[str] = field(default_factory=list)
    chunk_index:  int = 0


def _extract_asset_refs(text: str) -> tuple[list[str], list[str]]:
    """Return (table_ids, image_ids) found as placeholders in text."""
    tables, images = [], []
    for kind, asset_id in PLACEHOLDER_RE.findall(text):
        if kind == "TABLE":
            tables.append(asset_id)
        else:
            images.append(asset_id)
    return tables, images


def _extract_page_hint(text: str) -> int | None:
    match = PAGE_RE.search(text)
    return int(match.group(1)) if match else None


def _strip_page_markers(text: str) -> str:
    return PAGE_RE.sub("", text)


def _safe_split(text: str, max_chars: int) -> list[str]:
    """
    Split text into parts <= max_chars.
    Priority: paragraph → sentence → newline → hard cut.
    Never cuts inside a [[PLACEHOLDER]].
    """
    if len(text) <= max_chars:
        return [text]

    parts = []
    remaining = text

    while len(remaining) > max_chars:
        window = remaining[:max_chars]

        # Don't cut inside an open placeholder
        last_open = window.rfind("[[")
        if last_open != -1 and "]]" not in window[last_open:]:
            cut = last_open
        else:
            cut = window.rfind("\n\n")
            if cut < max_chars * 0.4:
                cut = window.rfind(". ")
                if cut > 0:
                    cut += 1
            if cut < max_chars * 0.4:
                cut = window.rfind("\n")
            if cut <= 0:
                cut = max_chars

        parts.append(remaining[:cut].strip())
        remaining = remaining[cut:].strip()

    if remaining:
        parts.append(remaining)

    return [p for p in parts if p]


def chunk_linear_text(linear_text: str, max_chars: int = DEFAULT_MAX_CHARS) -> list[RawChunk]:
    """
    Split linear text into chunks:
      1. Split at heading markers (# / ## / ###)
      2. For oversized sections split further by paragraph / sentence
      3. Each chunk carries the heading breadcrumb it lives under
    """
    heading_re  = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
    boundaries  = [(m.start(), m.group(1), m.group(2)) for m in heading_re.finditer(linear_text)]
    sections:     list[tuple[list[str], str]] = []
    current_path: list[str] = []

    if not boundaries:
        sections.append(([], linear_text.strip()))
    else:
        if boundaries[0][0] > 0:
            preamble = linear_text[:boundaries[0][0]].strip()
            if preamble:
                sections.append(([], preamble))

        for i, (pos, hashes, heading_text) in enumerate(boundaries):
            level        = len(hashes)
            current_path = current_path[:level - 1] + [heading_text]
            body_start   = pos + len(hashes) + 1 + len(heading_text)
            body_end     = boundaries[i + 1][0] if i + 1 < len(boundaries) else len(linear_text)
            body         = linear_text[body_start:body_end].strip()
            if body:
                sections.append((list(current_path), body))

    raw_chunks: list[RawChunk] = []
    chunk_idx = 0

    for heading_path, body in sections:
        for part in _safe_split(body, max_chars):
            if part.strip():
                raw_chunks.append(RawChunk(
                    text=part.strip(),
                    heading_path=heading_path,
                    chunk_index=chunk_idx,
                ))
                chunk_idx += 1

    return raw_chunks


# ─────────────────────────────────────────────────────────────────────────────
# Astra DB — collection setup
# ─────────────────────────────────────────────────────────────────────────────

def _hybrid_def() -> CollectionDefinition:
    return (
        CollectionDefinition.builder()
        .set_vector_service(provider="nvidia", model_name="NV-Embed-QA")
        .set_vector_dimension(1024)
        .set_vector_metric("cosine")
        .set_lexical(CollectionLexicalOptions(analyzer="standard"))
        .set_rerank(
            CollectionRerankOptions(
                service=RerankServiceOptions(
                    provider="nvidia",
                    model_name="nvidia/llama-3.2-nv-rerankqa-1b-v2",
                )
            )
        )
        .build()
    )


def _vector_def() -> CollectionDefinition:
    return (
        CollectionDefinition.builder()
        .set_vector_service(provider="nvidia", model_name="NV-Embed-QA")
        .set_vector_dimension(1024)
        .set_vector_metric("cosine")
        .build()
    )


def get_or_create_collections(database) -> dict:
    existing    = {c.name for c in database.list_collections()}
    collections = {}

    for name, def_fn in [
        (COLLECTION_CHUNKS, _hybrid_def),
        (COLLECTION_TABLES, _vector_def),
        (COLLECTION_IMAGES, _vector_def),
    ]:
        if name not in existing:
            print(f"[astra] Creating collection: {name}")
            database.create_collection(name, definition=def_fn())
        else:
            print(f"[astra] Collection exists:   {name}")
        collections[name] = database.get_collection(name)

    return collections


# ─────────────────────────────────────────────────────────────────────────────
# Document builders
# ─────────────────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_chunk_doc(
    chunk: RawChunk,
    source_doc: str,
    table_ids: list[str],
    image_ids: list[str],
    page: int | None = None,
) -> dict:
    import hashlib as _hashlib
    clean_text = _strip_page_markers(chunk.text).strip()
    heading_prefix = " > ".join(chunk.heading_path) + "\n\n" if chunk.heading_path else ""
    vectorize_text = heading_prefix + clean_text
    page = page if page is not None else _extract_page_hint(chunk.text)
    chunk_id = _hashlib.sha1(f"{source_doc}::{chunk.chunk_index}".encode()).hexdigest()[:16]

    return {
        "_id":           chunk_id,
        "$vectorize":    vectorize_text,
        "$lexical":      vectorize_text,
        "content":       clean_text,
        "title":         " > ".join(chunk.heading_path) if chunk.heading_path else source_doc,
        "heading_path":  chunk.heading_path,
        "content_type":  "text",
        "source_doc":    source_doc,
        "chunk_index":   chunk.chunk_index,
        "tables":        table_ids,   # IDs of tables referenced in this chunk
        "images":        image_ids,   # IDs of images referenced in this chunk
        "page":          page,
        "ingested_at":   _now(),
    }


def build_table_doc(asset_id: str, meta: dict) -> dict:
    heading     = meta.get("heading", "")
    rows, cols  = meta.get("shape", [0, 0])
    description = (
        f"Tabelle aus Abschnitt '{heading}'. "
        f"{rows} Zeilen, {cols} Spalten. "
        f"Inhalt: {meta['markdown'][:300]}"
    )

    return {
        "_id":           asset_id,
        "$vectorize":    description,
        "title":         heading or asset_id,
        "markdown":      meta["markdown"],
        "shape":         meta["shape"],
        "heading":       heading,
        "source_doc":    meta["source_doc"],
        "page":          meta.get("page"),
        "placeholder":   meta["placeholder"],
        "content_type":  "table",
        "ingested_at":   _now(),
    }


def build_image_doc(asset_id: str, meta: dict) -> dict:
    description = meta.get("description") or meta.get("caption") or ""
    heading     = meta.get("heading", "")
    vectorize   = f"Bild aus Abschnitt '{heading}'. {description}".strip()

    return {
        "_id":           asset_id,
        "$vectorize":    vectorize,
        "title":         heading or asset_id,
        "description":   description,
        "caption":       meta.get("caption", ""),
        "image_path":    meta.get("image_path"),
        "heading":       heading,
        "source_doc":    meta["source_doc"],
        "page":          meta.get("page"),
        "placeholder":   meta["placeholder"],
        "content_type":  "image",
        "ingested_at":   _now(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Upsert helper — re-running never errors on duplicate _id
# ─────────────────────────────────────────────────────────────────────────────

def upsert_batch(col, docs: list[dict], label: str) -> int:
    if not docs:
        return 0
    n = 0
    for doc in docs:
        if "_id" in doc:
            col.find_one_and_replace({"_id": doc["_id"]}, doc, upsert=True)
        else:
            col.insert_one(doc)
        n += 1
    print(f"[astra] {label}: upserted {n}")
    return n


# ─────────────────────────────────────────────────────────────────────────────
# Process one _data.json
# ─────────────────────────────────────────────────────────────────────────────

def process_json(
    json_path:   Path,
    collections: dict | None,
    max_chars:   int,
    dry_run:     bool,
) -> dict:
    """
    Load one _data.json, chunk it, push to Astra.
    Returns {"chunks": n, "tables": n, "images": n}.
    """
    data        = json.loads(json_path.read_text(encoding="utf-8"))
    linear_text = data["linear_text"]
    registry    = data["registry"]

    # source_doc comes from the registry (set by ingestion.py)
    source_doc = next(
        (v["source_doc"] for v in registry.values()),
        json_path.stem.replace("_data", ""),
    )

    print(f"\n[chunk] {json_path.name}  ({len(linear_text)} chars)")
    raw_chunks = chunk_linear_text(linear_text, max_chars=max_chars)
    print(f"        {len(raw_chunks)} chunks, "
          f"{sum(1 for v in registry.values() if v['type']=='table')} tables, "
          f"{sum(1 for v in registry.values() if v['type']=='image')} images")

    # Build docs
    chunk_docs = []
    for chunk in raw_chunks:
        tbl_ids, img_ids = _extract_asset_refs(chunk.text)

        # Determine page for this chunk from referenced assets (first available)
        page: int | None = _extract_page_hint(chunk.text)
        for aid in tbl_ids + img_ids:
            if page is not None:
                break
            meta = registry.get(aid)
            if meta:
                p = meta.get("page")
                if p is not None:
                    page = p
                    break

        chunk_docs.append(build_chunk_doc(chunk, source_doc, tbl_ids, img_ids, page=page))

    table_docs = [
        build_table_doc(aid, meta)
        for aid, meta in registry.items()
        if meta["type"] == "table"
    ]

    image_docs = [
        build_image_doc(aid, meta)
        for aid, meta in registry.items()
        if meta["type"] == "image" and meta.get("description")
    ]

    if dry_run:
        print(f"  [dry-run] would insert: "
              f"{len(chunk_docs)} chunks, {len(table_docs)} tables, {len(image_docs)} images")
        if chunk_docs:
            preview = {k: v for k, v in chunk_docs[0].items()
                       if k not in ("$vectorize", "$lexical")}
            preview["content"] = preview["content"][:150] + "..."
            print(json.dumps(preview, indent=2, ensure_ascii=False))
        return {"chunks": 0, "tables": 0, "images": 0}

    n_chunks = upsert_batch(collections[COLLECTION_CHUNKS], chunk_docs, "chunks")
    n_tables = upsert_batch(collections[COLLECTION_TABLES], table_docs, "tables")
    n_images = upsert_batch(collections[COLLECTION_IMAGES], image_docs, "images")

    return {"chunks": n_chunks, "tables": n_tables, "images": n_images}


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    DOTENV_PATH = Path(__file__).resolve().parents[1] / "env.download"
    load_dotenv(DOTENV_PATH)

    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "input",
        help="Path to a single *_data.json OR a folder containing them (e.g. tmp/)",
    )
    parser.add_argument("--dry-run",   action="store_true", help="Preview without writing to Astra")
    parser.add_argument("--max-chars", type=int, default=DEFAULT_MAX_CHARS,
                        help=f"Max chars per chunk (default: {DEFAULT_MAX_CHARS})")
    args = parser.parse_args()

    input_path = Path(args.input)

    # ── Collect all _data.json files ──────────────────────────────────────
    if input_path.is_file():
        json_files = [input_path]
    elif input_path.is_dir():
        json_files = sorted(input_path.rglob("*_data.json"))
        if not json_files:
            print(f"[error] No *_data.json files found in {input_path}")
            return 1
    else:
        print(f"[error] Path does not exist: {input_path}")
        return 1

    print(f"[plan] {len(json_files)} file(s) to process:")
    for f in json_files:
        print(f"   - {f}")

    # ── Connect to Astra (skip if dry-run) ────────────────────────────────
    collections = None
    if not args.dry_run:
        client      = DataAPIClient(os.environ["ASTRA_DB_APPLICATION_TOKEN"])
        database    = client.get_database(os.environ["ASTRA_DB_API_ENDPOINT"])
        collections = get_or_create_collections(database)

    # ── Process each file ─────────────────────────────────────────────────
    totals    = {"chunks": 0, "tables": 0, "images": 0}
    failures  = []

    for i, json_path in enumerate(json_files, 1):
        print(f"\n{'='*60}")
        print(f"[{i}/{len(json_files)}] {json_path.parent.name}/{json_path.name}")
        print(f"{'='*60}")
        try:
            counts = process_json(
                json_path=json_path,
                collections=collections,
                max_chars=args.max_chars,
                dry_run=args.dry_run,
            )
            for k in totals:
                totals[k] += counts[k]
        except Exception as e:
            print(f"  [FAIL] {e}")
            failures.append((json_path.name, str(e)))

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"[done] {len(json_files) - len(failures)}/{len(json_files)} files succeeded")
    print(f"       chunks : {totals['chunks']}")
    print(f"       tables : {totals['tables']}")
    print(f"       images : {totals['images']}")

    if failures:
        print(f"\n[failures]")
        for name, err in failures:
            print(f"   - {name}: {err}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())