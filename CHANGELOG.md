# Changelog

All notable changes to **Cycle Tracker** are documented here.

The project follows [Semantic Versioning](https://semver.org/) during active pre-1.0 development.

Stable releases are published from `main` and tagged as:

```text
vMAJOR.MINOR.PATCH
```

---

## Unreleased

### Added

- Git contribution and release conventions.
- Automated CI workflow conventions.
- Two-branch workflow with stable `main` and active development on `develop`.

---

## 0.9.0 — 2026-08-17

### Added

- Shared `core.js` utilities.
- Dependency-free unit tests.
- Automated syntax checks.
- Automated test execution.
- Automated production build validation.

### Changed

- Hardened profile and map persistence against malformed local data.
- Improved cycle boundary detection for sparse observations.
- Removed circular imports from chart rendering.

### Security

- Day notes and custom observation text are rendered using text nodes.
- Map identifiers used in HTML attributes are escaped.

---

## 0.8.0

Previous active-prototype milestone.

Earlier development history remains available through the Git commit history.