# Cycle Tracker

Educational symptothermal cycle tracking application focused on interpretation, visualization and information clarity.

The application is designed as a visual observation tool, not an automated fertility evaluator.  
Its purpose is to support manual interpretation while preserving ambiguity, context and user judgment.

---
<img width="1920" height="1200" alt="obrazek" src="https://github.com/user-attachments/assets/7bbacfcd-a1f3-4680-8e95-c7691a8d9359" />

<img width="340" height="775" alt="obrazek" src="https://github.com/user-attachments/assets/777ec49a-c2fd-465a-9501-7a84639bdc42" />



## Philosophy

The project is built around several core ideas:

- interpretation over automation
- visualization over prediction
- information density over simplified dashboards
- user judgment over algorithmic authority
- transparency over hidden calculations

The cycle map acts as a working surface for observation and interpretation rather than a decision engine.

The goal is not to tell the user what their cycle means, but to provide a structured environment where observations can be analyzed manually.

---

## Core Concepts

### Cycle Map First

The cycle map is the primary layer of the application.

Instead of separating observations into disconnected screens, the project focuses on a shared timeline structure inspired by:
- paper symptothermal charts
- spreadsheets
- long-form observation tracking

The calendar exists mainly as:
- navigation
- quick editing
- secondary overview

---

### Manual Interpretation

The application intentionally avoids automatic fertility evaluation.

The user manually defines:
- fertile window
- peak day
- coverline
- interpretation context

Visual overlays exist only as interpretation aids.

The system does not attempt to replace symptothermal reasoning with automated conclusions.

---

### Information Structure

The UI prioritizes:
- clarity
- consistency
- low visual noise
- dense but readable information

The project avoids:
- excessive dashboard styling
- oversized mobile-app UI patterns
- aggressive automation
- gamification

---

## Features  

### Cycle Tracking (WORK IN PROGRESS)

Daily observations include:
- basal body temperature
- bleeding
- discharge / mucus observations
- peak marker
- fertile range markers
- anomaly markers (planned)

All observations are manually editable.

---

### Visualization System (WORK IN PROGRESS)

The chart is designed as an interpretation surface rather than a statistics display.

Features include:
- temperature line visualization
- shared cycle timeline
- fertile overlays
- peak indicators
- coverline rendering
- cycle segmentation
- tooltip-based observation detail

The visualization system is built around layered overlays instead of isolated widgets.

---

### Manual Coverline 

The coverline is manually placed by the user.

The project intentionally avoids automatic temperature shift detection in order to preserve:
- interpretive flexibility
- educational value
- symptothermal methodology principles

---

### Calendar

The calendar acts as a secondary interaction layer.

It provides:
- navigation
- quick day selection
- editing access
- compact cycle overview

The calendar is not intended to replace the cycle map as the primary source of interpretation.

---

## Data Model

Cycle observations are currently stored locally using localStorage.

Example structure:

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
## Current Status

Prototype / experimental project.

The project is primarily focused on:

UI experimentation
visualization systems
symptothermal interpretation workflows
long-term architecture iteration

##Tech Stack
JavaScript
HTML5 Canvas
CSS
