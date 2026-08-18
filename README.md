<div align="center">

# Cycle Tracker

### Symptothermal cycle tracking, built around observation rather than prediction.

A browser-based application for recording daily cycle observations and reviewing them on a clear, traditional-style symptothermal map.

[**Live Demo**](https://cycle-6mf61zw3o-hubnerpatriks-projects.vercel.app/) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

<br>

![Active cycle map](assets/readme/active-map.jpeg)

</div>

## About

Cycle Tracker brings the structure of a paper symptothermal chart into a digital interface.

The app combines **basal body temperature, bleeding, cervical mucus, cervix observations, fertile days, markers and additional symptoms** in one synchronized view. It is designed as a **manual interpretation tool**: the application organizes and visualizes the data, while the user remains responsible for interpreting it.

It does **not** predict ovulation, assign fertility scores or automatically decide what the cycle data means.

> **Current status:** Active prototype · v0.9.0

## Core features

| | |
|---|---|
| **Temperature chart** | Basal body temperature plotted on a fixed 0.05 °C grid, with influence factors and optional measurement-time adjustment. |
| **Daily observations** | Track bleeding, spotting, clots, mucus, cervix observations, sex and additional symptoms. |
| **Manual interpretation** | Place fertile days, coverlines, peak markers and BBT / mucus / cervix markers yourself. |
| **Cycle map** | Review temperature and observations together on one day-by-day timeline. |
| **Calendar** | Navigate through days and see menstruation and fertile-day highlighting at a glance. |
| **Multiple maps** | Create, rename, close, reopen and filter separate cycle maps. |
| **Day summary** | Open a read-only overview of everything recorded for a selected day. |
| **Local storage** | Data currently stays in the browser using `localStorage`. |

## Daily tracking

Instead of one large form, observations are divided into focused editors. This keeps data entry clear while all information remains attached to the same day.

<table>
  <tr>
    <td width="50%"><img src="assets/readme/edit-day.jpeg" alt="Edit day menu"></td>
    <td width="50%"><img src="assets/readme/mucus.jpeg" alt="Mucus observation editor"></td>
  </tr>
  <tr>
    <td align="center"><sub>Edit individual observation categories</sub></td>
    <td align="center"><sub>Structured mucus observations</sub></td>
  </tr>
</table>

Temperature entries can include an influence factor and a different measurement time. The app can show a rough time-based adjustment while preserving the original measurement.

Cervix observations cover **firmness, height and openness**. Mucus observations include **sensation, slipperiness, discharge, consistency and color**, including a free-text option when a fixed category is not enough.

## Manual fertile range

Fertile days are selected directly from a calendar and do not need to form one continuous range. The selected days are then highlighted across the interface as visual context.

![Fertile range selection](assets/readme/fertile-range.jpeg)

## Day overview

Any selected date can be opened as a read-only summary, making it possible to review the complete daily record without reopening every editor.

![Day information](assets/readme/day-info.jpeg)

## Maps and profile

Cycle data is organized into named maps. Only one map is active at a time, while previous maps remain available for later review.

<table>
  <tr>
    <td width="50%"><img src="assets/readme/my-maps.jpeg" alt="Saved cycle maps"></td>
    <td width="50%"><img src="assets/readme/profile.jpeg" alt="User profile"></td>
  </tr>
  <tr>
    <td align="center"><sub>Saved maps with filtering and map management</sub></td>
    <td align="center"><sub>Profile and measurement settings</sub></td>
  </tr>
</table>

The main menu provides direct access to the profile, saved maps, map creation and the currently active map.

![Main menu](assets/readme/main-menu.jpeg)

## Design principles

**Interpretation over automation.** The app provides the working surface; it does not replace the user's judgment.

**Visualization over prediction.** There are no predicted ovulation dates, fertility scores or algorithmic confidence levels.

**Transparency over hidden calculations.** Values shown on the map come from data entered by the user. Manual elements such as coverlines and fertile days stay explicitly user-controlled.

**Privacy by default.** The current prototype stores its data locally in the browser and does not require a remote account or backend.

## Tech stack

`JavaScript` · `HTML5 Canvas` · `CSS` · `Vite` · `localStorage`

The frontend is built with **vanilla JavaScript and ES modules** without a framework.

<details>
<summary><strong>Project structure</strong></summary>

```text
app.js          Application entry point and active-map rendering
core.js         Shared date, temperature, DOM and chart utilities
store.js        Application state and localStorage persistence
domain.js       Cycle detection and chart-column generation
chart.js        Canvas temperature chart and markers
ui.js           Calendar, cycle map and observation modals
router.js       Screen navigation
views/          Main menu, profile, maps and map creation screens
```

</details>

## Local development

Requires **Node.js 20.19+** and npm.

```bash
npm ci
npm run dev
```

Run the project checks before committing:

```bash
npm run check
```

Development uses two branches:

- `main` — stable releases
- `develop` — ongoing development

See [CONTRIBUTING.md](CONTRIBUTING.md) for the repository workflow and [CHANGELOG.md](CHANGELOG.md) for release history.

## Data storage

The current prototype stores profile data, maps, daily observations, coverlines, fertile days and the active map identifier in `localStorage`.

A database-backed persistence layer is planned for a future version.

## Disclaimer

Cycle Tracker is an educational tracking and visualization project. It is **not a medical device** and does not provide medical advice, contraception guidance or an automated assessment of fertility.
