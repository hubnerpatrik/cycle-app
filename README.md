# Cycle Tracker (Demo)

A minimalist web application for manual cycle tracking based on the symptothermal method.

The goal is not automatic evaluation, but to provide tools that allow the user to interpret their own data.

---

## Features

### Calendar

* 30-day cycle overview
* Color coding:

  * Red → menstruation
  * Green → manually selected fertile range
  * Yellow → data exists but not marked as fertile
* Day selection via click
* Peak day indicated with a small marker

---

### Day Detail (Info Panel)

Displays data for the selected day:

* temperature
* bleeding
* discharge

---

### Edit Modal

Manual input for:

* temperature (text input)
* bleeding (none / spotting / menstruation)
* discharge (none / dry / moist / wet)
* peak marker (toggle)

All data is stored in localStorage.

---

### Temperature Chart (Canvas)

#### Visualization

* line chart of temperatures
* grid (minor + major lines)
* axes:

  * X → days
  * Y → temperature (°C)

#### Interaction

* click on chart → select day
* hover → tooltip with:

  * day
  * temperature
  * bleeding
  * discharge
  * peak status

#### Points

* normal → black
* selected → blue + ring
* peak → red circle

---

### Fertile Range

* manual range selection (range modal)
* visualization:

  * calendar → green days
  * chart → green background

---

### Coverline (Manual)

* SHIFT + click on chart sets coverline
* displayed as dashed horizontal line
* used for manual interpretation of temperature shift

---

### Tooltip

* custom DOM-based tooltip (not browser default)
* follows cursor
* displays detailed point data

---

### Dev Tools

* Dev reset → clears all stored data
* Seed → generates test data

---

## Data Model

Data is stored in localStorage as:

```json
{
  "1": {
    "temp": "36.50",
    "bleeding": "none",
    "discharge": "dry",
    "peak": false,
    "fertile": false
  }
}
```

---

## Design Principles

* no automatic fertility evaluation
* user-driven interpretation:

  * peak is marked manually
  * fertile window is selected manually
  * coverline is set manually

The chart acts as a visual tool, not a decision engine.

---

## Current Limitations

* no backend (localStorage only)
* fixed 30-day cycle
* coverline only via click (no drag)
* basic tooltip styling
* no strict input validation

---

## Next Steps 

* draggable coverline
* ovulation marker (vertical line)
* temperature validation
* export / import functionality
* separation of data vs analysis layer
* mobile UX improvements

---

## Tech Stack

* Vanilla JavaScript
* HTML5 Canvas
* CSS (Inter font)

---

## Goal

To build a simple, transparent cycle tracking tool that respects the principles of the symptothermal method without automating interpretation.

---

## Status

Prototype / Demo (functional, not production-ready)
