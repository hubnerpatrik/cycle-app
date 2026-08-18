# Changelog

All notable changes to this project are documented here.

The project follows [Semantic Versioning](https://semver.org/) while it is in active pre-1.0 development. Versions are released from `main` and tagged as `vMAJOR.MINOR.PATCH`.

## [Unreleased]

### Added

<<<<<<< Updated upstream
- Git contribution, release, and CI conventions.
- Two-branch workflow with stable `main` and working `develop`.

## [0.9.0] - 2026-08-17

### Added

- Shared `core.js` utilities and dependency-free unit tests.
- Automated syntax, test, and production-build checks.
=======
* Git contribution and release conventions.
* Automated CI workflow conventions.
* Two-branch workflow with stable `main` and active development on `develop`.

---

## 0.9.0 — 2026-08-18

### Added

* Shared `core.js` utilities for reusable application logic.
* Dependency-free unit tests.
* Automated syntax, test, and production build checks.
* Cross-cell selection across the cycle map.
* Persistent selection state.
* Profile photo placeholders for future profile-image support.
* Improved repository documentation, screenshots, release workflow, and contribution guidelines.
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
- Rendered day notes and custom observation text with text nodes.
- Escaped map identifiers used in HTML attributes.
=======
* Day notes and custom observation text are rendered using text nodes.
* Map identifiers used in HTML attributes are escaped.
* Improved handling of malformed persisted application data.

### Compatibility

* Existing profiles, maps, measurements, markers, and settings remain compatible.
* No data migration is required for the UI and responsive-design changes.
>>>>>>> Stashed changes

## [0.8.0]

<<<<<<< Updated upstream
- Previous active-prototype milestone. Earlier changes remain available in Git history.
=======
## 0.8.0 — 2026-08-12

### Added

* First-launch profile setup screen.
* Main menu with access to:

  * My Profile
  * My Maps
  * Create Map
  * Active Map
* Support for multiple named cycle maps.
* My Maps screen with saved-map browsing.
* Year and month filtering for saved maps.
* Create Map workflow.
* Active Map workflow.
* Legacy data migration into the new multi-map structure.

### Changed

* Replaced the original single `cycleData` storage model with a multi-map collection.
* Reorganized the application into separate navigation screens.
* Reduced the active-map action area to the most relevant controls.
* Added profile information alongside the active map.

---

## 0.4.2 — 2026-05-28

### Added

* Manual fertile-day selection.
* Manual peak-day selection.
* Marker system with chart annotations.
* Numbered markers above temperature points.
* Horizontal coverline support.
* Vertical coverline support.
* Separate coverline editing modes.
* Annotation toolbar for chart tools.
* Sediment and additional observation tracking.
* Structured daily information panel.

### Changed

* Redesigned the cycle-chart
>>>>>>> Stashed changes
