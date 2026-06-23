# Product Roadmap: BlackHole Cloud Storage Engine 🌌

This document outlines the planned milestones, feature improvements, and architectural goals for the BlackHole platform.

---

## 1. Near-Term Goals (Current Quarter)

### 1.1 Real-Time Synchronization via Websockets
* **Problem**: The client dashboard currently relies on polling to trace file processing states.
* **Goal**: Implement Supabase Realtime Change Listener inside the frontend client. Let the server push row changes directly to the UI, removing polling interval overhead entirely.

### 1.2 Access Control Share Links
* **Goal**: Expand `/share/{id}` to support passwords, download count limits, and read-only preview permissions.

---

## 2. Mid-Term Goals (Next Quarter)

### 2.1 Multi-Region Storage Proxy Caching
* **Goal**: Implement local caching in `/files/download-raw/{storage_key}`. Store popular binaries on memory disks or Edge caches (using Vercel Edge functions) to speed up repeat downloads.

### 2.2 Deep Semantic Content Search
* **Goal**: Integrate file content extraction. For documents (PDFs, TXT, DOCX), feed text excerpts to Groq Llama embeddings, calculate vector similarities, and return search results based on the file content.

---

## 3. Long-Term Vision (Future Milestones)

### 3.1 Collaborative Multi-User Shared Vaults
* **Goal**: Transition from strict single-owner isolation to role-based access control (RBAC). Let users invite teammates, configure permissions (Viewer, Editor, Owner), and sync collaborative folders.

### 3.2 Mobile Client App
* **Goal**: Build a cross-platform mobile client (using Flutter) incorporating the Watchdog Sync Daemon to automatically back up mobile folders.
