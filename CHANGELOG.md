# Changelog

All notable changes to **Cycle Tracker** are documented here.

The project follows [Semantic Versioning](https://semver.org/) during active pre-1.0 development.

Stable releases are published from `main` and tagged as:

```text
vMAJOR.MINOR.PATCH
```

---

## Unreleased

- No changes yet.

## 0.10.3 — 2026-08-24

### Changed

- Centralized chart interaction cleanup so Coverlines, crossed cells, and marker modes reset consistently when switching tools or screens.
- Simplified restore flows while preserving validation, persistence, and transient selection cleanup.
- Reused calculated cycle starts when building chart columns and consolidated repeated day-entry updates.

### Fixed

- Cycle identifiers now advance only when a new cycle start occurs.

## 0.10.2 — 2026-08-21

### Changed

- Coverlines can now be dragged by either arm or moved together from their shared corner while retaining their existing L shape; vertical coverlines snap to both cell edges and centers.
- The Coverlines button now creates the complete L shape with one chart click and shows a bottom-center placement hint.
- Cross-cell selection now adds a Save control to its bottom instruction pill instead of using a confirmation modal.
- Instruction pills for Coverlines, Cross cells, and Markers remain visible until their action is completed or cancelled.
- Existing Coverlines can be selected for a highlighted drag state and deleted as a complete L shape from the bottom action pill.
- A selected Coverline is deselected when the user clicks away from it.

## 0.10.1 — 2026-08-20

### Changed

- Calendar opens on the latest month represented in the active map, falling back to the local current month for empty maps.
- Crossed temperature-chart cells now use green lines.
- Horizontal and vertical coverlines meet at a shared origin and render as an L shape.

## 0.10.0 — 2026-08-18

### Added

- Per-map JSON backup export with saved author profiles and cycle observations.
- Shared-map import that preserves the recipient's profile and existing maps.
- Validation of imported application data.
- User-facing import and export controls in My Maps.
- Git contribution, release, and CI conventions.
- Two-branch workflow with stable `main` and working `develop`.

### Changed

- Refactored browser persistence behind a dedicated local-storage adapter.
- Improved resilience when loading persisted application state.
- Added pastel styling for map export and delete actions.

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
