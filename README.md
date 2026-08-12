# Cycle Tracker

Educational symptothermal cycle tracking application focused on interpretation, visualization, and information clarity. Designed as a visual observation tool, not an automated fertility evaluator. Its purpose is to support manual interpretation while preserving ambiguity, context, and user judgment.

Demo:
https://cycle-6mf61zw3o-hubnerpatriks-projects.vercel.app/

<img width="1504" height="844" alt="Main Menu" src="https://github.com/user-attachments/assets/ca410237-4a9e-45c0-84f2-d9bc358695ab" />

<img width="1402" height="818" alt="My Profile" src="https://github.com/user-attachments/assets/7ccc229f-2ff8-4b2a-af93-c659553a1b73" />

<img width="1683" height="878" alt="My Maps" src="https://github.com/user-attachments/assets/399f340b-c69f-4965-9963-ea1a21bdd24a" />

<img width="1794" height="2303" alt="Map edit page" src="https://github.com/user-attachments/assets/676afca3-a4c2-4348-8bb2-49e75e440428" />




---

## Philosophy

- **Interpretation over automation.** The app never tells the user what their cycle means — it gives them a structured surface to work it out themselves.
- **Visualization over prediction.** No fertility scores, no predicted ovulation dates, no algorithmic confidence levels.
- **Information density over simplified dashboards.** A symptothermal chart carries a lot of data by design; the UI respects that instead of hiding it behind cards and summaries.
- **User judgment over algorithmic authority.** Coverlines, fertile windows, and peak days are placed by the user, by hand, based on their own reading of the data.
- **Transparency over hidden calculations.** Every value shown on the chart or in the map can be traced back to something the user explicitly entered.
- **Privacy by default.** All data lives on the user's own device. Nothing is sent anywhere, sold, or used to train anything.

The cycle map is a working surface for observation, not a decision engine. It borrows its structure from paper symptothermal charts — dense, tabular, and legible at a glance — rather than from typical wellness-app dashboards.

---

# How the app works
 
## Maps
 
Data isn't tracked as one continuous chart — it's organized into named **maps**, each a self-contained set of days, coverlines, and a fertile window. A person can keep multiple maps (e.g. one per attempt, one per consultation period) and switch between them from **My Maps**, which lists every map with a date range, a quick preview (day count, temp readings, period days, notes), and a year/month filter.
 
Only one map is ever **active** at a time — the one shown on the cycle map and chart. Opening a map from the list makes it active and reopens it if it had been closed. A map can be explicitly saved and closed from the chart toolbar, which timestamps it and clears the active slot; closed maps stay browsable and reopenable from My Maps. New maps start empty and are named on creation.
 
## Navigation
 
The app is screen-based: a Main Menu links out to My Profile, My Maps, Create Map, and the Active Map, with the current screen highlighted in the header nav. First run goes straight to a Profile Setup screen before anything else is usable. The active-map screen is the only one that isn't a simple in-place render — it's the dashboard (calendar, chart, cycle map) and is only reachable once a map exists.
 
## Cycle map
 
The primary interaction surface is a horizontal timeline shared across a temperature chart and a stack of observation rows below it — bleeding, spotting, clots, mucus (sensation, slipperiness, visible discharge, consistency, color), cervix (firmness, height, openness), peak markers, sex, and additional symptoms. Every column is one day; every row is one observation type. Clicking any cell selects that day everywhere at once — chart, map, and calendar stay in sync.
 
## Temperature chart
 
Basal body temperature is plotted on a fixed 0.05°C grid, matching how symptothermal charts are read on paper. Each cycle is drawn as its own line, so temperature never visually connects across a cycle boundary. A gap of more than one day between two readings is drawn as a dashed segment rather than a straight line, making missing measurements visible instead of silently interpolated.
 
Days with a noted influence factor (alcohol, illness, travel, poor sleep, and so on) get a highlighted ring around their point, so an unusual reading can be immediately cross-checked against context before it's used to judge a trend.
 
## Measurement time adjustment
 
If a reading was taken at an unusual time, the user can log the actual time. The app calculates a rough adjustment relative to their usual measurement time (set in their profile) and shows both the raw and adjusted temperature — as a visual aid only, never silently substituted into the chart.
 
## Coverlines
 
Coverlines are placed manually by tapping the chart, not detected automatically. A horizontal coverline is anchored to a temperature value; a vertical coverline is anchored to a specific day. Because they're anchored to meaning rather than to pixel position, they stay correctly placed regardless of zoom level and are kept separate per cycle. Automatic thermal-shift detection is intentionally left out — reading the shift is part of the method, not something to hand off to an algorithm.
 
## Fertile window
 
Fertile days are picked directly on a calendar inside a dedicated picker, day by day rather than as a single locked-in range — so the selection doesn't have to be contiguous. Saving replaces the map's fertile-day flags with the current picks; a "clear" action removes picks for the month currently in view. The result is drawn as a soft highlight across the chart and the calendar so it stays visible as context while looking at everything else.
 
## Cervix and mucus observations
 
Cervix firmness, height, and openness, and mucus sensation, consistency, and color are all logged per day through dedicated modals and shown as compact symbols in the map rows. Mucus color includes an open "Other" option with free text, since real observations don't always fit a fixed palette.
 
## Markers
 
A day can be flagged as a peak day and tagged with one of three marker types — fertility, mucus, or cervix — each rendered in its own color on the chart and map. The marker value itself is picked from a short fixed list (P, 1–6), matching the notation used in the paper method rather than free text.
 
## Additional symptoms
 
A dedicated "Other" modal tracks sex (yes/no) and a free-text note for anything the method or the user wants to flag on a given day that doesn't have its own row — anomalies, one-off observations, additional symptoms.
 
## Calendar
 
A secondary, lower-density view for navigation: month-at-a-glance, menstruation and fertile-window highlighting, and cycle-day numbers, used mainly to jump to a day rather than to read the cycle in detail.
 
## Day info
 
A read-only summary view collects everything logged for a single day — temperature (with adjustment if applicable), bleeding, mucus, cervix, markers, sex, and additional symptoms — in one place, for quickly checking a day without opening every edit modal.
 
## Cycle navigation and zoom
 
Cycles are detected automatically from logged menstruation and can be browsed with previous/next controls, each shown independently on the chart and map. The chart can be zoomed in and out; column width, grid, and coverlines all stay correctly aligned at every zoom level.
---

## Data Model

Observations are stored locally via `localStorage`, keyed by date string. Coverlines, the fertile range, and profile info are stored alongside entries in the same object. This is still in WIP. In future updates i want use database as a solution.

```json
{
  "map-1735689000000-a1b2c3": {
    "id": "map-1735689000000-a1b2c3",
    "name": "My cycle",
    "createdAt": "2026-05-01T07:00:00.000Z",
    "status": "open",
    "closedAt": null,
    "entries": {
      "2026-05-01": {
        "temp": 36.5,
        "tempFactors": "illness",
        "measurementTime": "07:15",
        "bleeding": "menstruation",
        "sediment": false,
        "sensation": "dry",
        "stretch": false,
        "visible": false,
        "consistency": "",
        "color": "",
        "colorOther": "",
        "isPeak": false,
        "marker": "",
        "markerColor": "blue",
        "markerPointType": "temp",
        "cervixFirmness": "",
        "cervixHeight": "",
        "cervixOpenness": "",
        "other": "",
        "sex": false,
        "isFertile": true
      }
    },
    "coverlines": {
      "cycle-0": {
        "horizontalTemp": 36.6,
        "verticalKey": "2026-05-14"
      }
    },
    "fertileRange": { "start": null, "end": null }
  }
}
```

---

## Architecture
 
Vite + vanilla JS, no framework. The app is split into a core (`src`) and screens (`public/views`).
 
### Core
 
| File | Responsibility |
|---|---|
| `app.js` | Entry point — constants, utilities, layout geometry, `render()`, event listener initialization |
| `store.js` | `Store` class — app state and `localStorage` persistence |
| `domain.js` | Cycle detection, cycle-day calculation, building chart columns (`buildColumns`, `buildCycleColumns`) |
| `chart.js` | Canvas rendering (temperature chart, coverlines, markers) |
| `ui.js` | Calendar, info panel, cycle map rows, temperature scale, day-edit modals |
| `router.js` | Routing between screens (`menu`, `my-profile`, `my-maps`, `create-map`, `active-map`, `profile-setup`) |
 
### Screens (`public/views/`)
 
Each file exports a single render function that draws content into a passed-in container and wires up its own event handlers. They don't touch state directly — they talk to `store` and the router through callbacks (`onSave`, `onCreate`, `onNavigate`, `onOpen`, ...).
 
| File | Export | Screen |
|---|---|---|
| `menu.js` | `renderMenuView` | Main menu with tiles and an active-map preview |
| `profile.js` | `renderProfileScreen` | Shared profile form — used for both `profile-setup` and `my-profile` |
| `my-maps.js` | `renderMyMapsView` | List of saved maps with a year/month filter |
| `create-map.js` | `renderCreateMapView` | Form for starting a new empty map |
 
### Control flow
 
1. On `DOMContentLoaded`, `app.js` creates the `router` (`createRouter`) and wires the main nav buttons (`navMenuBtn`, `navProfileBtn`, ...) to `router.navigate(screen)`.
2. `router.js` calls the matching `render*` function from `views/` based on `screen`, passing it data from `store` plus callbacks.
3. The `active-map` screen is the exception — it isn't rendered through `views/`, but through `openActiveMapScreen()` in `app.js`, which reveals `#activeMapScreen` and runs `initActiveMap()` + `render()` (calendar, chart, cycle map).
4. Callbacks from the screens call `store` methods (`store.saveProfile()`, `store.createMap()`, `store.renameMap()`, `store.setActiveMapId()`), and the router then navigates onward or opens the active map.
### Persistence
 
Unchanged — `store.js` saves to `localStorage` under the keys `profile`, `maps`, `activeMapId` (see the Data Format section above). The router only reads/writes through `store`'s public methods, never `localStorage` directly.
 

---

## Tech Stack

JavaScript (ES modules) · HTML5 Canvas · CSS · Vite

---

## Status

Active prototype — v0.6.0
