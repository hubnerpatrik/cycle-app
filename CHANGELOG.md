# Changelog

All notable changes to this project are documented here.

The project follows [Semantic Versioning](https://semver.org/) while it is in active pre-1.0 development. Versions are released from `main` and tagged as `vMAJOR.MINOR.PATCH`.

## [Unreleased]

### Added

- Git contribution, release, and CI conventions.

## [0.9.0] - 2026-08-17

### Added

- Shared `core.js` utilities and dependency-free unit tests.
- Automated syntax, test, and production-build checks.

### Changed

- Hardened profile and map persistence against malformed local data.
- Improved cycle boundary detection for sparse observations.
- Removed circular imports from chart rendering.

### Security

- Rendered day notes and custom observation text with text nodes.
- Escaped map identifiers used in HTML attributes.

## [0.8.0]

- Previous active-prototype milestone. Earlier changes remain available in Git history.
