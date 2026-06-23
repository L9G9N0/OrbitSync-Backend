# Local Development Guide: BlackHole Cloud Storage Engine 🌌

This document provides a guide on how to set up, build, and run the BlackHole platform locally on your machine for development and testing.

---

## 1. Prerequisites

Ensure you have the following software installed:
* **Python**: `Version >= 3.10`
* **Node.js**: `Version >= 18.0` (Node 24 recommended) and npm
* **Docker & Docker Compose** (Optional, required for containerized storage)

---

## 2. Setting Up the Backend

### 2.1 Virtual Environment Setup
In the root directory of the project, run:

```bash
# Bootstrap virtual environment and install packages
make bootstrap
```

This target creates a `venv` folder and installs all library dependencies specified in `requirements.txt`.

### 2.2 Environment Variables Configuration
Create a `.env` file in the root directory:

```ini
# Active Storage Provider: 'local', 'minio', or 's3'
STORAGE_PROVIDER=local

# Local Emulator Directory
LOCAL_STORAGE_DIR=./local_vault_storage
API_BASE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

# Supabase Configurations (Retrieve from Supabase Dashboard)
SUPABASE_URL=https://your-supabase-id.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# Groq Cloud API (Optional, falls back to 'untagged' if blank)
GROQ_API_KEY=gsk_your_key_here
```

### 2.3 Running the FastAPI Web Server
To launch the server locally with auto-reload:

```bash
make run
```
The server will start on `http://127.0.0.1:8000`. You can inspect the Swagger documentation at `http://127.0.0.1:8000/docs`.

---

## 3. Setting Up the Frontend

Navigate to the `frontend` directory:

```bash
cd frontend

# Install package dependencies
npm install

# Run the Vite Dev Server
npm run dev
```

The frontend application will start on `http://localhost:5173`. Open this URL in your web browser.

---

## 4. Running the watchdog Sync Daemon

The sync daemon watches a local folder and synchronizes additions to the cloud vault automatically.

### 4.1 Sync Configuration
Create a configuration directory or set the sync folder path. By default, the daemon monitors `~/BlackHole_Sync` on your system.

Create the folder if it does not exist:
```bash
mkdir -p ~/BlackHole_Sync
```

### 4.2 Run the Daemon
In the repository root directory, run:

```bash
make daemon
```

The daemon will log in, fetch an authentication session token from Supabase, and start monitoring the directory.

---

## 5. Running the Backend Tests

We have two main test suites:
* `tests/test_api.py`: Route controller unit and integration tests (mocked dependencies).
* `tests/test_storage.py`: Storage provider driver integration tests.

### 5.1 Run all tests
Activate your virtual environment and run the test discovery command:

```bash
# Activate virtual environment
source venv/bin/activate

# Run unittest discovery
python -m unittest discover -s tests
```

---

## 6. Building the Production Assets

To compile the frontend project for production:

```bash
cd frontend
npm run build
```

This compiles static assets into `frontend/dist/` utilizing the Tailwind CSS compiler.
