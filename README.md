# Installation Guide

## Prerequisites

- **Python 3.10+** - download from [python.org](https://python.org/downloads)  
  During installation, check **"Add python.exe to PATH"**
- **Node.js 18+** - download from [nodejs.org](https://nodejs.org)

---

## 1. Backend

Open a terminal and navigate to the `backend/` folder:

```bash
cd backend
```

Create a virtual environment:

```bash
py -m venv .venv
# or
python -m venv .venv
```

> **Windows only:** if activation is blocked, run this first:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

Activate the virtual environment:

```bash
.\.venv\Scripts\activate
```

You should see `(.venv)` at the start of your prompt.

Install dependencies:

```bash
pip install -r requirements.txt
```

Copy the environment file and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Where to find it |
|---|---|
| `WATSONX_API_KEY` | IBM Cloud → Manage → IAM → API keys |
| `WATSONX_PROJECT_ID` | watsonx.ai Studio → Project → Manage → General |
| `WATSONX_URL` | `https://eu-de.ml.cloud.ibm.com` (Frankfurt) |
| `ASTRA_DB_API_ENDPOINT` | Astra DB → your database → Connect |
| `ASTRA_DB_APPLICATION_TOKEN` | Astra DB → your database → Connect |

Launch the backend:

```bash
python server.py
```

The API is now running at **http://localhost:8000**.  
You can verify it at [http://localhost:8000/health](http://localhost:8000/health).

---

## 2. Frontend

Open a **new terminal** and navigate to the frontend folder:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Copy the environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

Add the backend URL:

```bash
FASTAPI_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

The app will launch automatically at **http://localhost:3000**.

---

## Usage

1. Open [http://localhost:3000](http://localhost:3000) in your browser
2. Log in with your credentials
3. Use **"Dateien auswählen"** to pick individual documents or  
   **"Ordner auswählen"** to pick an entire folder of DOCX/PDF files
4. Watch the progress log as documents are ingested into Astra DB
5. Once ingestion is complete, use the chat to query your documents

---

## Troubleshooting

**`python` not found** - use `py` instead, or reinstall Python with "Add to PATH" checked.

**Activation blocked** - run the `Set-ExecutionPolicy` command above, then try again.

**`ModuleNotFoundError`** - make sure the venv is activated (`(.venv)` visible in prompt) before running `pip install`.

**Backend unreachable from frontend** - make sure `python server.py` is still running and `FASTAPI_URL=http://localhost:8000` is set in `.env.local`.

**Astra DB connection error** - double-check that your token starts with `AstraCS:` and your endpoint URL ends with `.apps.astra.datastax.com`.


# TODOs
- show that documents have been ingested
- fix pages in docling
- how to link the images and tables
- check whether documents have already been ingested and what happens
- drop database button
- session per user?
- option for images