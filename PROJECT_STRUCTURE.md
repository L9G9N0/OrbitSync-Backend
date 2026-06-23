# Project Structure Reference: BlackHole Cloud Storage Engine 🌌

This document outlines the file layout and component mapping across the BlackHole repository.

---

## 1. Directory Tree Overview

```
OrbitSync-Backend/
├── .vercel/                  # Vercel project deployment caching configurations
├── app/                      # Backend FastAPI Application codebase
│   ├── __init__.py           # Package indicator
│   ├── api.py                # Route controllers and endpoints logic
│   ├── main.py               # Application launcher, CORS configs, and startup hooks
│   └── core/                 # Backend system utilities and helper modules
│       ├── __init__.py       # Package indicator
│       ├── ai.py             # Groq AI Cloud semantic categorization worker
│       ├── config.py         # Pydantic Settings configuration loader
│       ├── db.py             # Supabase client instantiation proxy
│       └── storage/          # Storage Provider interface and implementations
│           ├── __init__.py   # Provider mapping registry
│           ├── base.py       # Abstract Base Class StorageProvider contract
│           ├── exceptions.py # Unified storage exception definitions
│           ├── factory.py    # Provider instantiator factory class
│           ├── local_provider.py # Local filesystem emulator driver
│           ├── minio_provider.py # Default local container S3 MinIO driver
│           └── s3_provider.py    # Production Cloudflare R2 / AWS S3 driver
├── daemon/                   # Observatory Daemon background script
│   └── sync_daemon.py        # Monitors local folder and auto-syncs files via API
├── frontend/                 # Client Frontend Single Page Application (SPA)
│   ├── src/                  # React source files
│   │   ├── assets/           # UI media, graphics, and background layouts
│   │   ├── components/       # Interface UI widgets and panels
│   │   │   ├── ActivityFeed.tsx   # Visual activity logs dashboard widget
│   │   │   ├── Dashboard.tsx      # Main application dashboard layout
│   │   │   ├── FileCard.tsx       # File item card component with options menu
│   │   │   ├── FileList.tsx       # Lists file cards with infinite layout grid
│   │   │   ├── KeyboardShortcutsHelp.tsx # Keyboard short overlays widget
│   │   │   ├── LoginPage.tsx      # Gateway sign-in / sign-up screen
│   │   │   ├── SearchBox.tsx      # Custom semantic query filter input
│   │   │   ├── ShareModal.tsx     # Link sharing popup overlay
│   │   │   ├── StorageMeter.tsx   # Storage quota meter widget
│   │   │   └── UploadZone.tsx     # File drag-and-drop region widget
│   │   ├── lib/              # Client infrastructure libraries
│   │   │   └── supabase.ts   # Client-side Supabase connection client
│   │   ├── services/         # Server communications module
│   │   │   └── api.ts        # Communicates with API server endpoints
│   │   ├── store/            # State contexts and providers
│   │   │   ├── AuthContext.tsx   # Authentication status provider
│   │   │   └── UploadContext.tsx # Upload queues, retries, and polling provider
│   │   ├── types/            # TypeScript models and interfaces
│   │   │   └── index.ts      # TypeScript types definition index
│   │   ├── App.css           # Global custom stylesheet
│   │   ├── App.tsx           # App Router and layout gate
│   │   ├── index.css         # Styling system configuration (Tailwind directives)
│   │   └── main.tsx          # Client strictmode renderer
│   ├── vite.config.ts        # Vite packaging configuration
│   ├── tsconfig.json         # TypeScript compiler mappings
│   └── package.json          # Frontend packages registry
├── migrations/               # Database SQL schema migration files
│   └── supabase_rls_policies.sql # Migration to create user columns and enable RLS
├── tests/                    # Backend testing modules
│   ├── test_api.py           # Unit / Integration tests for routes and controllers
│   └── test_storage.py       # Integration tests for storage provider drivers
├── Dockerfile                # API container configuration
├── docker-compose.yml        # Multi-container orchestration loader
├── Makefile                  # Automation target tasks loader
├── requirements.txt          # Python dependency requirements list
└── README.md                 # Product overview file
```

---

## 2. Directory Responsibilities

### 2.1 Backend Application (`app/`)
* **Role**: Orchestrates FastAPI route structures and coordinates third-party services (Supabase, Groq, Cloudflare).
* **Core Design Patterns**:
  * Dependency Injection for mock providers and authentication contexts.
  * Lazy initialization proxying to optimize startup speed.
  * Agnostic storage driver interface.

### 2.2 Watchdog Synchronization Daemon (`daemon/`)
* **Role**: Watches local user folders. It uses a clean Python thread structure with the `watchdog` framework to observe filesystem updates and push them directly to `/upload/` using user authentication.

### 2.3 Single Page Frontend (`frontend/`)
* **Role**: Modern dark-themed dashboard.
* **Architecture Style**:
  * Container/Component design pattern: Widgets are structured in `components/`, contexts in `store/`, and service functions in `services/`.
  * Framework integrations: Vite, Tailwind CSS v4 compiler, Framer Motion, and TanStack Query.

### 2.4 Database Migrations (`migrations/`)
* **Role**: Keeps track of SQL DDL operations to alter database tables, enable RLS policies, and define permissions.

### 2.5 Test Suites (`tests/`)
* **Role**: Verifies backend functionality.
  * `test_api.py`: Validates FastAPI controllers using mock dependencies.
  * `test_storage.py`: Tests the storage drivers on the local machine.
