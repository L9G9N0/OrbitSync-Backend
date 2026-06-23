# Contributing Guidelines: BlackHole Cloud Storage Engine 🌌

We welcome contributions to the BlackHole open-source project! Please review the guidelines below to ensure a smooth contribution process.

---

## 1. Code of Conduct

All contributors must adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please be respectful and professional in all communication.

---

## 2. Setting Up for Local Development

Please review our [Local Development Guide](DEVELOPMENT.md) for steps on:
1. Bootstrapping virtual environments.
2. Configuring local environment variables.
3. Launching backend API and React frontend servers.
4. Executing Python unit tests.

---

## 3. Pull Request Guidelines

Before submitting a Pull Request (PR):
1. **Branch Naming**: Use a prefix indicating the purpose of the branch (e.g. `feat/user-isolation`, `fix/route-precedence`).
2. **Linting and Type Checks**:
   * Run type checking on the frontend:
     ```bash
     cd frontend && npx tsc --noEmit
     ```
   * Run python unit tests:
     ```bash
     python -m unittest discover -s tests
     ```
3. **Commit Messages**: Write professional, semantic commit messages (e.g. `feat: add RLS table policies`, `fix: correct search placeholder locator`).
4. **Documentation**: If your change modifies API routes, configuration settings, or folder layout, update the relevant markdown documentation (`API.md`, `DEVELOPMENT.md`, `PROJECT_STRUCTURE.md`).

---

## 4. Coding Standards

* **Python (Backend)**: Follow PEP 8 guidelines. Keep code clean and properly documented.
* **React/TypeScript (Frontend)**: Standard ESLint configurations are active. Avoid `any` types; prefer strict TypeScript definitions.
* **Database SQL**: Place all database adjustments inside `migrations/` with explanatory comments.
