# Cycle Tracker

Educational symptothermal cycle tracking application focused on interpretation, visualization and information clarity. Designed as a visual observation tool, not an automated fertility evaluator. Its purpose is to support manual interpretation while preserving ambiguity, context and user judgment.

Demo:
https://cycle-6mf61zw3o-hubnerpatriks-projects.vercel.app/

<img width="1920" height="1200" alt="obrazek" src="https://github.com/user-attachments/assets/d8bda5e4-e699-4fb2-a53d-721e7bb4ace7" />
<img width="340" height="775" alt="obrazek" src="https://github.com/user-attachments/assets/a78a2937-806b-428c-b051-cc6b09bddac8" />




---

## Philosophy

- interpretation over automation
- visualization over prediction
- information density over simplified dashboards
- user judgment over algorithmic authority
- transparency over hidden calculations

The cycle map acts as a working surface for observation and interpretation rather than a decision engine. The goal is not to tell the user what their cycle means, but to provide a structured environment where observations can be analyzed manually.

---

## Core Concepts

**Cycle map first.** The primary interaction surface is a shared horizontal timeline displaying all observations in a structured grid — inspired by paper symptothermal charts, spreadsheets, and long-form observation tracking. The calendar exists mainly as navigation and secondary overview.

**Manual interpretation.** The application intentionally avoids automatic fertility evaluation. The user manually defines the fertile window, peak day, coverline, and interpretation context. Visual overlays exist only as interpretation aids.

**Information structure.** The UI prioritizes clarity, consistency, low visual noise, and dense but readable information. The project avoids excessive dashboard styling, oversized mobile-app UI patterns, aggressive automation, and gamification.

---

## Features

**Cycle map** — primary interaction surface with temperature line, per-cycle segmentation, bleeding row, mucus/discharge row, sediment indicator, peak marker, fertile window overlay, anomaly markers, cycle day numbers, and manual coverline tools.

**Coverline tools** — manually placed by the user. Horizontal coverline spans the full chart at a clicked temperature level. Vertical coverline marks the thermal shift boundary at a clicked column. Automatic temperature shift detection is intentionally omitted to preserve interpretive flexibility and symptothermal methodology principles.

**Calendar** — secondary interaction layer for navigation, quick day selection, editing access, and compact cycle overview.

**Day modal** — all observations are manually editable: temperature, bleeding, discharge, sediment, peak, fertile, anomaly marker, and free-text notes.

---

## Data Model

Observations stored locally via localStorage, keyed by date string.

```json
{
  "2026-05-01": {
    "temp": 36.50,
    "bleeding": "menstruation",
    "discharge": "dry",
    "sediment": false,
    "other": "",
    "isFertile": false,
    "isPeak": false,
    "marker": ""
  }
}
```

---

## Planned

- free placement of vertical coverline across any column range
- chart zoom and temperature scale adjustment (0.05°C step)
- extended temperature range display
- influence factor input (alcohol, illness, sleep disruption) with visual dot indicator
- expanded discharge observation types and additional indicator controls
- cycle goal setup (avoid pregnancy, achieve pregnancy, observation only)
- measurement method and time configuration per cycle
- cycle map session management — start and close individual maps
- info panel redesign with action-focused layout
- multi-device persistence via backend or IndexedDB

---

## Architecture
-app.js      constants, utils, layout geometry, render, init
-store.js    Store class, localStorage persistence
-domain.js   cycle detection, column building
-chart.js    canvas rendering, coverline interaction
-ui.js       calendar, info panel, map rows, modal
---

## Tech Stack

JavaScript (ES modules) · HTML5 Canvas · CSS

---

## Status

Active prototype — v0.5.0
