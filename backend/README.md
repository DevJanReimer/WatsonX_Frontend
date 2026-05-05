# Backend — ingestion & chunking

This folder contains a small FastAPI service and helpers to ingest documents,
chunk them and push assets to Astra DB. The README below explains how to run
the backend locally and how the frontend can integrate with it.

## Services / scripts

- `server.py` — FastAPI app exposing:
  - `POST /ingest` — accepts one or more file uploads (multipart) and returns a `job_id`.
    The job runs in the background (ingest → chunk → push to Astra).
  - `GET /status/{job_id}` — poll for job progress, logs and final status.
  - `GET /health` — simple health check.

- `ingestion.py` — document extractor (DOCX / PDF). Produces a `_data.json` and extracted images.
- `chunker.py` — chunks `_data.json` and writes to Astra DB collections.
- `pipeline.py` — helper to run end-to-end for a folder of documents (uses `ingest` + `chunker.process_json`).
- `drop_collection.py` — convenience script to drop the three Astra collections.

## Requirements

Install into a virtualenv and install dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
```

## Environment

Create a `.env` (or set env vars) with at least the following for Astra:

- `ASTRA_DB_APPLICATION_TOKEN` — token for Data API
- `ASTRA_DB_API_ENDPOINT` — Astra DB endpoint (database id / path used by astrapy)

If you plan to run the vision model pass in `ingestion.py` you should also set:

- `WATSONX_API_KEY`
- `WATSONX_PROJECT_ID`
- `WATSONX_URL` (optional)

## Run the API server (development)

```bash
# from repo root
cd backend
# ensure env vars are set (or .env present)
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

The server currently uses permissive CORS in `server.py` (allow_origins=['*']).
Tighten this before production.

## How the frontend can connect

There are two straightforward options — choose one depending on whether you
want the frontend to talk directly to Astra (current app) or route uploads
through the Python backend.

1) Frontend → Python backend (recommended if you want server-side ingest)

  - Client side should POST a `multipart/form-data` request to the backend
    `POST /ingest`. FastAPI expects the file field name to match the parameter
    name in `server.py` (the endpoint signature is `files: list[UploadFile] = File(...)`).

  - Example client (browser fetch):

    ```js
    const form = new FormData();
    // note: backend expects field name 'files' (multiple)
    form.append('files', file1);
    form.append('files', file2);

    const res = await fetch('http://localhost:8000/ingest', { method: 'POST', body: form });
    const body = await res.json(); // contains job_id
    // poll /status/{job_id} until status is 'done'
    ```

  - The server responds with `{ job_id, files: [...] }`. Poll `GET /status/{job_id}` to read progress/logs.

  - If you prefer to keep the frontend API route (`/api/upload`) as a Next.js serverless function,
    you can proxy from that route to the backend instead of writing directly to Astra. Example proxy (Node):

    ```ts
    // inside app/api/upload/route.ts (server-side)
    const form = await req.formData();
    const forward = new FormData();
    for (const file of form.getAll('file')) forward.append('files', file as File);
    const backendRes = await fetch('http://localhost:8000/ingest', { method: 'POST', body: forward });
    return NextResponse.json(await backendRes.json(), { status: backendRes.status });
    ```

  - Note: the current frontend client `DocumentUpload.tsx` uses form field name `file` for each file.
    The backend expects `files`. If you post directly from the browser to `/ingest`, append each file
    with the same key `files` (see example above). If you proxy via the Next.js route, convert `file` → `files`.

2) Frontend → Next.js API → Astra (current app behavior)

  - The repo's existing Next API `app/api/upload/route.ts` writes chunks directly to Astra using
    `lib/astra.ts`. That means the frontend can upload to `/api/upload` and the Next server will write
    into Astra without invoking the Python backend.

  - If you want both behaviors, update the Next.js route to forward to the Python backend conditionally
    (e.g. based on an env var `USE_PY_BACKEND=true`).

## End-to-end pipeline (CLI)

To run ingestion + chunking for a whole folder locally (useful for batch runs):

```bash
# dry-run: does not write to Astra
python backend/pipeline.py path/to/docs --dry-run

# real run (requires ASTRA vars)
python backend/pipeline.py path/to/docs
```

## Notes & gotchas

- CORS: `server.py` currently allows `*`. Restrict origin to your Next.js frontend in production.
- Field name mismatch: the frontend UI uses `file` per input; FastAPI expects `files` as the repeated form key.
- The FastAPI endpoint runs ingestion & chunking in a background thread — large uploads will be processed
  asynchronously; poll `/status/{job_id}` for progress.

If you'd like, I can:

- Add a small proxy implementation to `app/api/upload/route.ts` (but that touches frontend files), or
- Modify `server.py` to accept `file` keys too (I can implement that change inside `backend/` only).

---
README generated by automated assistant — adjust examples (host/ports) to your environment.
