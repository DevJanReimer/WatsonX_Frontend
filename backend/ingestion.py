"""
ingestion.py — Document extraction with image VLM description.

Walks a DOCX/PDF in document order and produces:
  - Linear text with [[TABLE:tbl_001]] / [[IMAGE:img_001]] placeholders
  - Hierarchical list items preserved with indentation
  - A registry of every table and image, keyed by the same ID
  - Extracted image PNGs saved to ./extracted_images/

Usage:
    python ingestion.py path/to/file.docx
    python ingestion.py path/to/file.pdf
    python ingestion.py path/to/file.docx --no-vision

Requirements in .env:
    WATSONX_API_KEY, WATSONX_PROJECT_ID, WATSONX_URL
"""
from __future__ import annotations

import base64
import hashlib
import os
import sys
from io import StringIO
from pathlib import Path
import tempfile

from docling.document_converter import DocumentConverter
from docling_core.types.doc import (
    DocItemLabel,
    ListItem,
    PictureItem,
    SectionHeaderItem,
    TableItem,
    TextItem,
)
from dotenv import load_dotenv
from pathlib import Path
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def make_asset_id(source_stem: str, asset_type: str, index: int) -> str:
    stem_hash = hashlib.sha1(source_stem.encode()).hexdigest()[:8]
    return f"{asset_type}_{stem_hash}_{index:03d}"


def make_placeholder(asset_id: str) -> str:
    prefix = "TABLE" if asset_id.startswith("tbl_") else "IMAGE"
    return f"[[{prefix}:{asset_id}]]"


def is_inside_table(item, table_crefs: set[str]) -> bool:
    """
    Return True if the item's structural parent is a table.
    Docling items have a .parent RefItem with a .cref string like '#/tables/2'.
    This is the reliable way to detect rich-cell spillover — no text matching needed.
    """
    parent = getattr(item, "parent", None)
    if parent is None:
        return False
    cref = getattr(parent, "cref", "") or ""
    return cref in table_crefs


def _item_page(item) -> int | None:
    prov = getattr(item, "prov", None)
    if not prov:
        return None
    return getattr(prov[0], "page_no", None)


# ─────────────────────────────────────────────────────────────────────────────
# Table rendering
# ─────────────────────────────────────────────────────────────────────────────

def table_to_markdown(table) -> str:
    """
    Build markdown from cell.text — handles rich cells correctly.
    Multi-line cell content joined with ' · '.
    """
    grid = table.data.grid
    if not grid:
        return "(empty table)"

    def cell_text(cell) -> str:
        return cell.text.strip().replace("\n", " · ")

    rows_md = []
    for r, row in enumerate(grid):
        cells = " | ".join(cell_text(c) for c in row)
        rows_md.append(f"| {cells} |")
        if r == 0:
            sep = " | ".join("---" for _ in row)
            rows_md.append(f"| {sep} |")

    return "\n".join(rows_md)


# ─────────────────────────────────────────────────────────────────────────────
# Vision
# ─────────────────────────────────────────────────────────────────────────────

VISION_MODEL_ID   = "meta-llama/llama-3-2-11b-vision-instruct"
DESCRIPTION_MAX_CHARS = 400

VISION_PROMPT = """\
Du bist ein Schweizer Informationssicherheits-Experte.

Beschreibe dieses Bild auf Deutsch in maximal 3 Sätzen. Konzentriere dich auf:
- Architekturdiagramme: Systemkomponenten, Dienste, Verbindungen
- Netzwerktopologie: Zonen, Firewalls, Segmentierung
- Datenflüsse: Richtung, Verschlüsselung, Schnittstellen
- Zugriffskontrollen und Sicherheitsgrenzen

Falls das Bild nicht ISDP-relevant ist (Logo, Dekorationsbild, leeres Diagramm), \
antworte ausschliesslich mit: NICHT_RELEVANT

Beschreibung:\
"""


def _load_vision_model() -> ModelInference | None:
    api_key    = os.getenv("WATSONX_API_KEY")
    project_id = os.getenv("WATSONX_PROJECT_ID")
    url        = os.getenv("WATSONX_URL", "https://eu-de.ml.cloud.ibm.com")

    if not api_key or not project_id:
        print("[vision] Credentials missing — skipping VLM pass")
        return None

    return ModelInference(
        model_id=VISION_MODEL_ID,
        credentials=Credentials(url=url, api_key=api_key),
        project_id=project_id,
        params={"temperature": 0.1, "max_tokens": 150},
    )


def _cap_description(text: str, max_chars: int = DESCRIPTION_MAX_CHARS) -> str:
    if len(text) <= max_chars:
        return text
    cutoff = text[:max_chars].rfind(". ")
    if cutoff > max_chars * 0.5:
        return text[:cutoff + 1].strip()
    return text[:max_chars].strip() + "…"


def describe_image(model: ModelInference, image_path: Path, heading_context: str = "") -> str | None:
    with image_path.open("rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")

    prompt = VISION_PROMPT
    if heading_context:
        prompt = f"Abschnitt im Dokument: {heading_context}\n\n{VISION_PROMPT}"

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
                {"type": "text", "text": prompt},
            ],
        }
    ]

    response    = model.chat(messages=messages)
    description = response["choices"][0]["message"]["content"].strip()

    if "NICHT_RELEVANT" in description.upper():
        return None

    return _cap_description(description)


# ─────────────────────────────────────────────────────────────────────────────
# Main extraction
# ─────────────────────────────────────────────────────────────────────────────

def ingest(file_path: str, run_vision: bool = True, work_dir: Path | None = None) -> dict:
    """
    Extract a document into linear text + asset registry.

    Args:
        file_path:  Path to the input DOCX/PDF file.
        run_vision: Whether to run the VLM image description pass.
        work_dir:   Optional directory for temp outputs (inspection.txt, images,
                    data.json). If None, a fresh tempfile.mkdtemp() folder is
                    created automatically. Caller is responsible for cleanup
                    (shutil.rmtree(result["work_dir"])) if desired.

    Returns:
        {
          "linear_text": str,       # text with [[TABLE:...]] / [[IMAGE:...]] placeholders
          "registry": {             # asset_id -> metadata dict
            "<asset_id>": {
              "type":        "table" | "image",
              "placeholder": "[[TABLE:...]]" | "[[IMAGE:...]]",
              "source_doc":  str,
              "page":        int | None,
              "heading":     str,
              # tables:
              "markdown":    str,
              "shape":       [rows, cols],
              # images:
              "image_path":  str | None,
              "caption":     str,
              "description": str | None,
            }
          },
          "work_dir": str,          # path to temp folder — inspect or delete as needed
        }
    """
    import json as _json
    import tempfile

    path = Path(file_path)
    if not path.exists():
        print(f"[error] File not found: {path}")
        sys.exit(1)

    # ── Working directory ─────────────────────────────────────────────────
    if work_dir is None:
        work_dir = Path("tmp") / path.stem
        work_dir.mkdir(parents=True, exist_ok=True)
    else:
        work_dir = Path(work_dir)
        work_dir.mkdir(parents=True, exist_ok=True)

    img_dir = work_dir / "images"
    img_dir.mkdir(exist_ok=True)
    print(f"[tmp] Working directory: {work_dir}")

    # ── Docling conversion ────────────────────────────────────────────────
    print(f"[docling] Converting {path.name} ...")
    converter = DocumentConverter()
    result    = converter.convert(str(path))
    doc       = result.document
    print(f"[docling] Done — {len(doc.texts)} texts, "
          f"{len(doc.tables)} tables, {len(doc.pictures)} images")

    # ── Build set of table crefs for rich-cell spillover detection ────────
    # Each TableItem has a self_ref like '#/tables/2'. Any TextItem whose
    # parent.cref matches one of these is rich-cell spillover → skip.
    table_crefs: set[str] = set()
    for table in doc.tables:
        cref = getattr(table, "self_ref", None)
        if cref:
            table_crefs.add(cref)

    # ── Load vision model ─────────────────────────────────────────────────
    vision_model = None
    if run_vision and doc.pictures:
        print(f"[vision] Loading {VISION_MODEL_ID} ...")
        vision_model = _load_vision_model()

    # ── Walk document in order ────────────────────────────────────────────
    linear_parts: list[str] = []
    registry:     dict      = {}

    img_count       = 0
    tbl_count       = 0
    current_heading = ""

    for item, level in doc.iterate_items():
        page = _item_page(item)
        print(f"[page] {page}")

        if page is not None:
            linear_parts.append(f"[[PAGE:{page}]]")

        # ── Heading ───────────────────────────────────────────────────────
        if isinstance(item, SectionHeaderItem):
            current_heading = item.text
            linear_parts.append(f"\n{'#' * max(level, 1)} {item.text}\n")

        # ── Text / List item ──────────────────────────────────────────────
        elif isinstance(item, TextItem):

            # Skip rich-cell spillover: parent cref points to a table
            if is_inside_table(item, table_crefs):
                continue

            text = item.text.strip()
            if not text:
                continue

            # Preserve hierarchy: list items get indentation + bullet.
            # ListItem is a subclass of TextItem in newer Docling versions;
            # fall back to label check for older versions.
            is_list = isinstance(item, ListItem) or (
                hasattr(item, "label") and
                getattr(item.label, "value", item.label) == "list_item"
            )

            if is_list:
                indent = "  " * max(level - 1, 0)
                linear_parts.append(f"{indent}- {text}")
            else:
                linear_parts.append(text)

        # ── Table ─────────────────────────────────────────────────────────
        elif isinstance(item, TableItem):
            tbl_count += 1

            rows = len(item.data.grid)
            cols = len(item.data.grid[0]) if rows > 0 else 0
            page = getattr(item.prov[0], "page_no", None) if item.prov else None

            asset_id    = make_asset_id(path.stem, "tbl", tbl_count)
            placeholder = make_placeholder(asset_id)
            md          = table_to_markdown(item)

            registry[asset_id] = {
                "type":        "table",
                "placeholder": placeholder,
                "source_doc":  path.name,
                "page":        page,
                "heading":     current_heading,
                "markdown":    md,
                "shape":       [rows, cols],
            }

            linear_parts.append(f"\n{placeholder}\n")
            print(f"[table] {asset_id}  {rows}×{cols}  heading='{current_heading}'")

        # ── Image ─────────────────────────────────────────────────────────
        elif isinstance(item, PictureItem):
            img_count += 1
            page    = getattr(item.prov[0], "page_no", None) if item.prov else None
            caption = item.caption_text(doc) or ""

            asset_id    = make_asset_id(path.stem, "img", img_count)
            placeholder = make_placeholder(asset_id)

            img_filename = f"{path.stem}_img_{img_count}.png"
            img_path     = img_dir / img_filename
            saved_ok     = False

            try:
                item.image.pil_image.save(img_path, format="PNG")
                saved_ok = True
            except Exception as e:
                print(f"[image] Save failed for {img_filename}: {e}")

            description = None
            if vision_model and saved_ok:
                print(f"[vision] Describing {img_filename} ...")
                try:
                    description = describe_image(
                        model=vision_model,
                        image_path=img_path,
                        heading_context=current_heading,
                    )
                    status = f"{len(description)} chars" if description else "NICHT_RELEVANT"
                    print(f"[vision] {img_filename} → {status}")
                except Exception as e:
                    print(f"[vision] Error on {img_filename}: {e}")

            registry[asset_id] = {
                "type":        "image",
                "placeholder": placeholder,
                "source_doc":  path.name,
                "page":        page,
                "heading":     current_heading,
                "caption":     caption,
                "image_path":  str(img_path) if saved_ok else None,
                "description": description,
            }

            linear_parts.append(f"\n{placeholder}\n")

    # ── Assemble linear text ──────────────────────────────────────────────
    linear_text = "\n".join(linear_parts)

    # ── Save inspection report ────────────────────────────────────────────
    report = StringIO()

    def w(*args, **kwargs):
        print(*args, **kwargs, file=report)

    w("=" * 80)
    w(f"FILE: {path.resolve()}")
    w("=" * 80)

    w("\n\n── LINEAR TEXT (with placeholders) ───────────────────────────────────────────\n")
    w(linear_text)

    w("\n\n── ASSET REGISTRY ────────────────────────────────────────────────────────────\n")
    for asset_id, meta in registry.items():
        w(f"\n{asset_id}  [{meta['type'].upper()}]")
        w(f"  placeholder : {meta['placeholder']}")
        w(f"  source_doc  : {meta['source_doc']}")
        w(f"  page        : {meta['page']}")
        w(f"  heading     : {meta['heading']}")
        if meta["type"] == "table":
            w(f"  shape       : {meta['shape'][0]} rows × {meta['shape'][1]} cols")
            w(f"  markdown:")
            for line in meta["markdown"].splitlines():
                w(f"    {line}")
        elif meta["type"] == "image":
            w(f"  image_path  : {meta['image_path']}")
            w(f"  caption     : {meta.get('caption') or 'none'}")
            w(f"  description : {meta['description'] or 'NICHT_RELEVANT / not run'}")

    report_path = work_dir / f"{path.stem}_inspection.txt"
    report_path.write_text(report.getvalue(), encoding="utf-8")

    # ── Save structured JSON (for debugging / manual chunker runs) ────────
    data_path = work_dir / f"{path.stem}_data.json"
    data_path.write_text(
        _json.dumps(
            {"linear_text": linear_text, "registry": registry},
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    print(f"\n[done] Report  → {report_path}")
    print(f"       Data    → {data_path}")
    print(f"       Images  → {img_dir}  ({img_count} files)")
    print(f"       Assets  → {len(registry)} total "
          f"({tbl_count} tables, {img_count} images)")

    return {
        "linear_text": linear_text,
        "registry":    registry,
        "work_dir":    str(work_dir),   # caller can shutil.rmtree() this when done
    }


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    DOTENV_PATH = Path(__file__).resolve().parents[1] / "env.download"
    load_dotenv(DOTENV_PATH)

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python ingestion.py <file.docx|file.pdf> [--no-vision]")
        print("  python ingestion.py <folder/> [--no-vision]")
        sys.exit(1)

    no_vision  = "--no-vision" in sys.argv
    input_path = Path(sys.argv[1])

    # ── Folder mode ───────────────────────────────────────────────────────
    if input_path.is_dir():
        supported = {".docx", ".doc", ".pdf"}
        files = sorted(
            p for p in input_path.rglob("*")
            if p.is_file() and p.suffix.lower() in supported
        )
        if not files:
            print(f"[error] No supported files found in {input_path}")
            sys.exit(1)

        print(f"[batch] {len(files)} file(s) found in {input_path}")
        for i, f in enumerate(files, 1):
            print(f"\n{'='*60}")
            print(f"[{i}/{len(files)}] {f.name}")
            print(f"{'='*60}")
            try:
                result = ingest(str(f), run_vision=not no_vision)
                print(f"  linear_text : {len(result['linear_text'])} chars")
                print(f"  assets      : {list(result['registry'].keys())}")
            except Exception as e:
                print(f"  [FAIL] {f.name}: {e}")

    # ── Single file mode ──────────────────────────────────────────────────
    elif input_path.is_file():
        result = ingest(str(input_path), run_vision=not no_vision)
        print(f"\nLinear text length : {len(result['linear_text'])} chars")
        print(f"Registry entries   : {list(result['registry'].keys())}")

    else:
        print(f"[error] Path does not exist: {input_path}")
        sys.exit(1)