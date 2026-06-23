# Release Management Process: BlackHole Cloud Storage Engine 🌌

This document defines the software release lifecycle, quality gates, validation checklists, and environment promotion routines for the BlackHole platform.

---

## 1. Release Quality Gates

Before any code is merged into the `main` branch or deployed to production environments, it must pass the following quality gates:

### 1.1 Static Analysis & Compiler Passing
* **Backend**: No Python syntax errors.
* **Frontend**: TypeScript type check must pass cleanly without compilation errors:
  ```bash
  cd frontend && npx tsc --noEmit
  ```

### 1.2 Unit & Integration Test Suites
* All unittest modules must return `OK`:
  ```bash
  python -m unittest discover -s tests
  ```

### 1.3 Production E2E Verification
* Execute the Playwright browser automation verification script to test real logins, uploads, sharing, and RLS database isolation checks:
  ```bash
  ./venv/bin/python <path_to_verification_script>/verify_production.py
  ```
  All **31 checks** must return `PASS`. The generated report `production_verification_report.md` must contain zero failures.

---

## 2. Release Steps

Follow this workflow to release updates:

### Step 1: Branch Isolation
All changes must be implemented in a feature branch (e.g. `feat/upload-progress`) branched from `main`.

### Step 2: Testing and Review
1. Open a Pull Request (PR) on GitHub.
2. Ensure CI tests pass (if configured).
3. Conduct a security and architecture peer review.

### Step 3: Version Bump
Update the version inside the FastAPI definition in `app/main.py` and the client package files:
* App metadata launcher version in `app/main.py`:
  ```python
  app = FastAPI(version="1.1.0")
  ```
* Package registry version in `frontend/package.json`:
  ```json
  "version": "1.1.0"
  ```
* Record all changes in `CHANGELOG.md`.

### Step 4: Staging & Committing
Stage only the clean source, migration, and configuration files, avoiding local env files or screenshots:
```bash
git status
git add <files_to_commit>
git commit -m "feat: [detailed commit message]"
```

### Step 5: Push and Deploy
Push the code to the main repository:
```bash
git push origin main
```
* **Vercel** will automatically pull, compile, and alias the deployment to `https://orbit-sync-backend.vercel.app`.
* **Render** will pull the latest commit and trigger the build for `blackhole-backend`.

### Step 6: Verify Live Services
Perform final route verification checks:
```bash
curl -i "https://orbitsync-backend.onrender.com/files/status/?ids=1"
```
Ensure the server responds with HTTP 401 (proves correct routing and JWT integration) instead of redirecting or returning HTTP 405.
