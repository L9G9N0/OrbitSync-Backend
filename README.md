# BlackHole 🌌
### Autonomous AI-Powered Cloud Storage Engine

BlackHole (formerly OrbitSync Vault) is a cloud-native intelligent storage platform designed for zero-friction file organization, semantic search indexing, and real-time background sync. Built with a high-performance **FastAPI** backend, **Groq LLM (Llama 3.3)** semantic profiler, **Supabase** metadata ledger, **MinIO** object storage, and a modern reactive **React/Vite** client compiled with the cutting-edge **Tailwind CSS v4** engine.

---

## 🛠️ Architecture & System Dataflow

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant API as FastAPI Backend
    participant Storage as MinIO Object Storage
    participant DB as Supabase DB Ledger
    participant AI as Groq AI API (Llama-3.3)

    User->>API: POST /upload/ (multipart/form-data)
    Note over API: Generate unique storage key (UUID)
    API->>Storage: Stream upload binary object
    API->>DB: Insert metadata ledger (status="Processing")
    API-->>User: HTTP 200 (Success message, starts polling)
    
    Note over API: Hand off heavy AI task to Background Task
    API->>AI: generate_file_tags(filename)
    AI-->>API: Return tags JSON (e.g. ["finance", "receipt"])
    API->>DB: Update files table with tags
    
    loop Polling
        User->>API: GET /files/
        API->>DB: Retrieve records
        DB-->>API: Return data with tags
        API-->>User: Return records (tags populated = Tagged animation)
    end
```

### Core Architecture Components

1. **FastAPI Gateway Server**: Manages uploads, download tickets, expiring presigned sharing links, and tag queries.
2. **Groq AI Profiler**: Parses filenames asynchronously using the `llama-3.3-70b-versatile` model to extract semantic categorizations without reading raw contents, preserving privacy.
3. **Supabase Database**: Stores document schemas (id, filename, storage_key, tags list, creation timestamp).
4. **MinIO Object Storage**: Stores binary blobs securely with randomly generated storage UUID keys, shielding actual assets from public endpoints. Supports automatic bucket creation and connection retry layers.
5. **Vite React Frontend**: Modern dark-themed dashboard using TanStack Query for caching, Framer Motion for thinking scanner states, and standard progress tracking.
6. **Watchdog Daemon**: A python background service that monitors local directories for updates and pushes modifications directly to the server.

---

## 📂 Project Structure

```
OrbitSync-Backend/
├── app/                  # FastAPI Application Layer
│   ├── core/             # Configuration, Supabase client, AI Groq wrappers
│   │   ├── storage/      # Provider-agnostic Storage Service Abstraction
│   │   │   ├── base.py           # Abstract StorageProvider contract
│   │   │   ├── minio_provider.py # Default S3-compatible MinIO driver
│   │   │   ├── s3_provider.py    # AWS S3 driver
│   │   │   ├── local_provider.py # File storage emulator driver for tests
│   │   │   ├── factory.py        # Driver selector based on config
│   │   │   └── exceptions.py     # Custom error definitions
│   ├── api.py            # Route Controllers (upload, download, share, search, list, delete)
│   └── main.py           # Application Entry & CORS configurations
├── daemon/               # Background Watchdog Services
│   └── sync_daemon.py    # Directory observer sync script
├── tests/                # System Test Suites
│   └── test_storage.py   # Storage provider unit tests
├── frontend/             # Single Page Application
│   ├── src/
│   │   ├── assets/       # Visual media and logo vectors
│   │   ├── components/   # Dashboard widgets (UploadZone, FileList, SearchBox, etc.)
│   │   ├── services/     # API Client using fetch & XHR progress
│   │   ├── store/        # React Context (Upload Queue, Polling & Activity logs)
│   │   ├── types/        # TypeScript Interfaces
│   │   ├── App.tsx       # Routing & QueryClient initialization
│   │   └── main.tsx      # StrictMode launcher
│   ├── vite.config.ts    # Build config utilizing Tailwind CSS v4 compiler plugin
│   └── package.json      # Client package dependencies
├── requirements.txt      # Python library dependencies
├── docker-compose.yml    # Single-command orchestrator for local deployment
├── Dockerfile            # Container build specification
└── Makefile              # Task Automation runner
```

---

## ⚡ API Endpoint Documentation

| Endpoint | Method | Security | Description |
| :--- | :--- | :--- | :--- |
| `/upload/` | `POST` | Public | Uploads file to MinIO and starts async AI tagging. |
| `/files/` | `GET` | Public | Lists all vault files metadata and tags. |
| `/files/{id}` | `DELETE` | Public | Deletes files from DB ledger and MinIO storage. |
| `/download/{id}` | `GET` | Presigned (1 Hour) | Generates a 1-hour secure URL for direct asset retrieval. |
| `/share/{id}` | `GET` | Presigned (Dynamic) | Generates shared URL. Expiry minutes range: `1` to `10080` (7 Days). |
| `/search/` | `GET` | Public | Query search tags (case-insensitive database search). |

---

## ⚙️ Setting Up & Launching Locally

### 1. Environment Configuration

Create a `.env` file in the root directory containing the credentials (see `.env.example` for reference):

```ini
# Active Storage Provider: 'local', 'minio', or 's3'
STORAGE_PROVIDER=local

# Local Storage settings
LOCAL_STORAGE_DIR=./local_vault_storage
API_BASE_URL=http://localhost:8000

# Metadata Connection (Supabase)
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_KEY=your_supabase_anon_or_service_role_key

# AI Semantic Profiler (Groq Cloud)
GROQ_API_KEY=gsk_your_groq_api_key
```

> [!NOTE]
> **Graceful Startup Audit**: To ensure continuous availability, the backend will boot successfully and serve the `/health` endpoint even if environment keys are missing or contain placeholder values. Any configuration errors will be highlighted as clear warning/error banners in the startup logs. Relying routes (like file upload/download) will return structured HTTP 500 error messages if invoked while misconfigured.
>
> **Supabase Key Selection**: Since the backend executes server-to-server operations, using the Supabase `service_role` key is recommended to bypass Row-Level Security (RLS) constraints. If the `anon` key is used, make sure policies are defined on the `files` table to permit inserts, reads, updates, and deletes.


### 2. Launching with Docker Compose 🐳

To launch the backend API and MinIO storage engine with single-command persistence, simply run:

```bash
docker compose up --build
```
This command:
* Boots the MinIO object container (API on port `9000`, Console Browser on port `9001`).
* Spins up a helper image to assert and create the default bucket (`blackhole`).
* Builds the FastAPI server (exposed on port `8000`).

### 3. Launching Manually (Without Docker)

First, bootstrap the virtual environment and install backend requirements:
```bash
make bootstrap
```

Ensure a local MinIO server instance is running on port `9000` (or update `MINIO_PORT`). Launch the FastAPI Server:
```bash
make run
```

Launch the Watchdog Sync Daemon (monitors `~/BlackHole_Sync` folder on your system):
```bash
make daemon
```

### 4. Launching the React Frontend

Open a new terminal window, navigate to the `frontend/` folder, install JavaScript dependencies, and run the Vite dev server:

```bash
cd frontend
npm install
npm run dev
```

The frontend client will boot on `http://localhost:5173`. Open this URL in a modern web browser to access the BlackHole interface.

---

## ⌨️ Desktop Shortcuts

To support zero-friction interaction, BlackHole exposes several global desktop keybindings:

* `Shift + K` : Revel the keyboard shortcuts help overlay.
* `Shift + U` : Trigger the native file browser selector dialog.
* `/` : Focus the semantic tag search input box.
* `ESC` : Dismiss open sharing or shortcut modals.

---

## 📄 License & Standards

Maintained by the BlackHole Open Source Engineering Group. Standardized under MIT license rules. Code review complies with industry security guidelines for cloud engineering projects.
