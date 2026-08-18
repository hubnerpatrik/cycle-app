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

- Per-map JSON backup export with saved author profiles and cycle observations.
- Shared-map import that preserves the recipient's profile and existing maps.
- Validation of imported application data.
- User-facing data management controls in My Profile.
- Git contribution, release, and CI conventions.
- Two-branch workflow with stable `main` and working `develop`.

### Changed

- Refactored browser persistence behind a dedicated local-storage adapter.
- Improved resilience when loading persisted application state.

## 0.9.0 — 2026-08-17

### Added

- Shared `core.js` utilities and dependency-free unit tests.
- Automated syntax, test, and production-build checks.

### Changed

* Refactored shared utilities out of feature-specific modules.
* Hardened profile and map persistence against malformed local data.
* Improved cycle boundary detection for sparse observations.
* Removed circular imports from chart rendering.
* Simplified map controls and removed deprecated cycle navigation controls.
* Updated the chart to display all columns of the current map.
* Unified buttons, typography, spacing, cards, navigation, and modal layouts.
* Refined the pastel visual design across the application.
* Improved desktop, tablet, and mobile layouts.
* Improved calendar readability on narrow screens.
* Improved map action layouts for touch devices.
* Improved modal centering, scrolling, and short-screen behavior.
* Added safe-area handling for mobile devices with display cutouts.
* Prevented unintended horizontal page overflow.

### Security

- Rendered day notes and custom observation text with text nodes.
- Escaped map identifiers used in HTML attributes.

## [0.8.0]

- Previous active-prototype milestone. Earlier changes remain available in Git history.
