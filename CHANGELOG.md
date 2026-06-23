# Changelog: BlackHole Cloud Storage Engine 🌌

All notable changes to the BlackHole repository are documented in this file.

---

## [1.1.0] - 2026-06-23

### Added
* **FastAPI Route Precedence Fix**: Swapped declaration order for `/files/status/` and `/files/{file_id}` routes. Parameter routes no longer intercept status requests, resolving `405 Method Not Allowed` issues.
* **Supabase SQL Schema Update**: Added migration statements in `supabase_rls_policies.sql` to verify and create the `user_id` column on the `files` table if it is missing.
* **Playwright Automated Tests**: Integrated end-to-end browser automation checking two-user signup, login, session persistence, RLS verification, upload, sharing, deletion, and console monitoring.
* **Optimized Status Polling**: Added the `/files/status/` selective status check endpoint on the backend, minimizing payload size during browser polling.
* **Detailed API and Architecture Docs**: Created `ARCHITECTURE.md`, `API.md`, `PROJECT_STRUCTURE.md`, `DEVELOPMENT.md`, `DEPLOYMENT.md`, and `SECURITY.md`.

### Fixed
* **Search Input Selector**: Fixed placeholder matcher in verification scripts to target the `'profiling'` keyword instead of the absent `'search'` placeholder.
* **Case-Insensitive Page Validations**: Updated verification checks to use case-insensitive matching for dashboard UI elements.
* **Delete Validation Robustness**: Modified delete verification to query element visibility directly, ignoring visual logs and popups.
* **Watchdog Sync Daemon Auth**: Equipped `sync_daemon.py` with Supabase Auth credentials loader and automatic Bearer JWT injection.
* **Local DNS Resolution Bypass**: Integrated Vercel Anycast IP resolution overrides (`76.76.21.21`) inside test frameworks.

---

## [1.0.0] - 2026-06-21

### Added
* **User-Level Ownership Isolation**: Enforced user checks across list, download, share, search, and delete backend endpoints.
* **Authorization Headers Interception**: Integrated FastAPI dependencies to fetch and verify Supabase JWT tokens.
* **Framer Motion Micro-animations**: Implemented status spinners on dashboard widgets.
* **Supabase RLS Database Hardening**: Created `supabase_rls_policies.sql` and activated Row-Level Security on metadata files.
* **Watchdog File Synchronizer**: Built initial local directory watchdog background synchronization service.
* **Groq Cloud AI Profiler Integration**: Integrated async filename profiling utilizing Llama 3.3.
* **MinIO Object Storage Driver**: Created base storage class and default S3 compatible driver.
* **Docker Compose Orchestrator**: Container configuration file mapping API server and local storage bucket.
