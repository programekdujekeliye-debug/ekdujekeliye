# Performance & Render RAM Optimization Guide

## 1. Hosting Environment & Limits

* **Hosting Provider**: Render Free/Starter Web Service.
* **Hardware Ceiling**: 512 MB RAM / 0.1–0.5 vCPU.
* **Challenge**: Node.js heap leaks, unindexed database queries, loading thousands of Mongoose documents, and in-memory image manipulations can trigger Out-Of-Memory (OOM) fatal crashes.

---

## 2. Optimization Rules & Guardrails

### A. Lean Database Queries
* **Rule**: Always append `.lean()` to Mongoose queries on read-only endpoints to bypass heavy Mongoose document change-tracking wrappers.
* **Benefit**: Reduces memory allocation by ~70% when fetching lists of hundreds of registrations.

### B. Aggressive Projections & Pagination
* **Rule**: Never execute `find({})` without projection on public APIs.
* **Rule**: Admin table queries must enforce cursor/offset pagination (`limit: 50` or `limit: 100`) rather than dumping the entire historical database into RAM.

### C. Lightweight In-Memory Caching for Public Discovery
* **Endpoints**: `GET /api/public/home` and `GET /api/programs/public`.
* **Strategy**: Cache serialized event list for 60 seconds. Invalidate cache on event updates (`POST /api/programs`, `PUT /api/programs/:id`).
* **RAM Impact**: Minimal (~50 KB for event list), prevents hundreds of simultaneous database lookups during peak traffic surges.

### D. Lazy-Loading Heavy Admin Modules
* Heavy libraries such as OCR (`tesseract.js`) and complex image processors (`jimp`) are only loaded or invoked when the specific admin manual receipt verification is triggered, preventing memory bloat during regular customer ticket sales.
