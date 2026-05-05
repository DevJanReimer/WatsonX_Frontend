from __future__ import annotations

import shutil
import tempfile
import threading
import traceback
import uuid
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Import your existing functions directly
from ingestion import ingest
from chunker import process_json, get_or_create_collections

from astrapy import DataAPIClient
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="ISDP Ingestion API")

# Allow your TypeScript frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store — good enough for MVP
jobs: dict[str, dict] = {}


def _run_pipeline(job_id: str, files: list[Path], work_root: Path) -> None:
    """Runs in a background thread — ingestion + chunking per file."""
    job = jobs[job_id]
    job["status"] = "running"

    def log(msg: str) -> None:
        print(f"[job {job_id}] {msg}", flush=True)
        job["log"].append(msg)

    try:
        # ── Step 0: connect to Astra ──────────────────────────────────────
        log("Connecting to Astra DB...")
        token    = os.environ.get("ASTRA_DB_APPLICATION_TOKEN", "")
        endpoint = os.environ.get("ASTRA_DB_API_ENDPOINT", "")
        if not token or not endpoint:
            raise RuntimeError(
                f"Missing env vars — "
                f"ASTRA_DB_APPLICATION_TOKEN={'set' if token else 'MISSING'}, "
                f"ASTRA_DB_API_ENDPOINT={'set' if endpoint else 'MISSING'}"
            )
        log(f"Astra endpoint: {endpoint}")

        client      = DataAPIClient(token)
        database    = client.get_database(endpoint)
        log("Astra connected. Getting/creating collections...")
        collections = get_or_create_collections(database)
        log(f"Collections ready: {list(collections.keys())}")

        total = len(files)
        for i, file_path in enumerate(files, 1):
            job["progress"] = f"[{i}/{total}] Ingesting {file_path.name}"
            log(f"[{i}/{total}] Starting {file_path.name}  (size: {file_path.stat().st_size} bytes)")

            try:
                # Step 1 — docling extraction ─────────────────────────────
                log(f"[{i}/{total}] Running docling on {file_path.name}...")
                result    = ingest(str(file_path), run_vision=False,
                                   work_dir=work_root / file_path.stem)
                json_path = work_root / file_path.stem / f"{file_path.stem}_data.json"
                log(f"[{i}/{total}] Extraction done — json at {json_path} (exists={json_path.exists()})")

                if not json_path.exists():
                    raise FileNotFoundError(f"Expected {json_path} but file was not created")

                # Step 2 — chunk + push to Astra ──────────────────────────
                job["progress"] = f"[{i}/{total}] Chunking {file_path.name}"
                log(f"[{i}/{total}] Chunking {file_path.name}...")
                counts = process_json(
                    json_path=json_path,
                    collections=collections,
                    max_chars=1400,
                    dry_run=False,
                )
                log(
                    f"  ✓ {file_path.name}: "
                    f"{counts['chunks']} chunks, "
                    f"{counts['tables']} tables, "
                    f"{counts['images']} images"
                )
            except Exception as e:
                tb = traceback.format_exc()
                print(f"[job {job_id}] ✗ {file_path.name} FAILED:\n{tb}", flush=True)
                log(f"  ✗ {file_path.name}: {type(e).__name__}: {e}")

        job["status"]   = "done"
        job["progress"] = f"Completed {total} file(s)"
        log("Pipeline finished.")

    except Exception as e:
        tb = traceback.format_exc()
        print(f"[job {job_id}] Pipeline outer error:\n{tb}", flush=True)
        job["status"] = "error"
        job["error"]  = f"{type(e).__name__}: {e}"
        log(f"Fatal error: {type(e).__name__}: {e}")
    finally:
        shutil.rmtree(work_root, ignore_errors=True)


@app.post("/ingest")
async def ingest_files(files: list[UploadFile] = File(...)):
    """
    Accept one or more document uploads, run the full pipeline.
    Returns a job_id to poll for status.
    """
    if not files:
        raise HTTPException(400, "No files provided")

    job_id    = str(uuid.uuid4())[:8]
    work_root = Path(tempfile.mkdtemp(prefix=f"isdp_job_{job_id}_"))

    # Save uploaded files to temp folder
    saved: list[Path] = []
    for upload in files:
        dest = work_root / upload.filename
        with dest.open("wb") as f:
            shutil.copyfileobj(upload.file, f)
        saved.append(dest)

    # Register job
    jobs[job_id] = {
        "status":   "queued",
        "progress": "Queued",
        "files":    [f.name for f in saved],
        "log":      [],
        "error":    None,
    }

    # Run in background thread so the HTTP response returns immediately
    thread = threading.Thread(
        target=_run_pipeline,
        args=(job_id, saved, work_root),
        daemon=True,
    )
    thread.start()

    return {"job_id": job_id, "files": [f.name for f in saved]}


@app.get("/status/{job_id}")
def get_status(job_id: str):
    """Poll this endpoint to check progress."""
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")
    return jobs[job_id]


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)