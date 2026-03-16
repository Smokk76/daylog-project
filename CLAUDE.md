# CLAUDE.md

This file provides guidance for AI assistants working in this repository.

## Project Overview

**DayLog** is a browser-based construction project estimating tool. It calculates labour costs from room dimensions, work item selections, and unit rates. Key capabilities include:

- Room-level work breakdowns with auto-calculated quantities from dimensions
- 12 work categories (Plastering, Painting, Flooring, Tiling, etc.)
- Extension building cost calculator with structural components
- CSV export for reporting
- Full backup/restore via JSON files, with snapshots and localStorage persistence

## Tech Stack

- **React 18** + **TypeScript 5** (strict mode) single-page application
- **Vite 5** for dev server and build
- **Node.js built-in test runner** with `tsx` for TypeScript test execution
- No external state management — all state lives in `App.tsx`
- No CSS framework — custom styles in `src/styles.css`

## Repository Structure

```
src/
  App.tsx                  # Main component (~3400 lines): all UI, state, routing
  main.tsx                 # React entry point
  types.ts                 # All TypeScript interfaces and types
  styles.css               # Application styles
  data/
    defaults.ts            # Default data, room/work item catalogs, project init
  lib/
    calculations.ts        # Room geometry and work item quantity/cost calculations
    extensionCalculations.ts # Extension quote cost calculator
    csv.ts                 # CSV export utilities
    storage.ts             # localStorage, backup, snapshot management
    importValidation.ts    # JSON import shape validation

tests/
  calculations.test.ts          # Room calculation logic
  extensionCalculations.test.ts # Extension quote geometry and costs
  importValidation.test.ts      # Import validation
  normalizeProjectData.test.ts  # Data migration and normalization
  storageUiPrefs.test.ts        # Storage and UI preferences

scripts/
  backup-push.sh           # Commit backup JSON to git and push
  backup-pull.sh           # Pull backup from git and copy to Downloads

backups/
  main-backup.json         # Current project backup (committed)
```

## Development Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # TypeScript compile + Vite production build
npm run preview      # Preview production build
npm test             # Run all tests once
npm run test:watch   # Run tests in watch mode
npm run backup:push  # Commit latest backup file and push to GitHub
npm run backup:pull  # Pull backup from GitHub to Downloads
```

## Running Tests

Tests use Node's built-in test runner with TypeScript via `tsx`:

```bash
npm test
# or watch mode:
npm run test:watch
```

All test files are in `tests/` and follow the pattern `*.test.ts`. There is no test config file — the runner is invoked directly in `package.json`.

To add a test, create a `tests/yourFeature.test.ts` file using Node's `node:test` and `node:assert` modules:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
```

## TypeScript Configuration

- Strict mode is enabled — all types must be explicit
- Target: ES2020, module: ESNext, moduleResolution: bundler
- `tsconfig.json` covers `src/`, `tests/`, and `vite.config.ts`
- No path aliases configured

## Key Domain Concepts

### Data Model (see `src/types.ts`)

- **`ProjectData`** — top-level structure containing rooms, settings, extension quotes, overhead items
- **`Room`** — dimensions (`width`, `length`, `height`), door count, manual area overrides, work selections
- **`WorkItem`** — a unit of work with a `key`, category, `source` (how quantity is derived), `rateKey`, and optional overrides
- **`Level`** — enum for 5 floor levels: `Basement`, `Ground`, `First`, `Second`, `Loft`
- **`WorkCategory`** — 12 categories (Plastering, Painting, Flooring, Tiling, Carpentry, etc.)
- **`UnitType`** — `m2`, `lm`, `each`, `fixed`
- **`ExtensionQuote`** — complex structure for building extension cost estimation

### Calculation Flow (`src/lib/calculations.ts`)

1. `computeRoom(room)` — derives `floorArea`, `ceilingArea`, `wallArea`, `perimeter`, `skirting`, `architrave` from raw dimensions
2. `baseQtyFromSource(room, source)` — maps a work item's `source` field to the correct computed area
3. `getQtyForWork(room, item)` — returns manual override qty or computed qty
4. `getRateForWork(settings, item)` — returns manual override rate or default rate
5. `buildLineItems(room, items, settings)` — builds full list of costed line items for a room
6. `roomTotals(room, ...)` / `summaryTotals(rooms, ...)` — aggregate cost and man-day totals

### Extension Calculator (`src/lib/extensionCalculations.ts`)

`calculateExtensionQuote(quote)` computes total cost for a building extension:
- Foundations, walls, roof, structural elements (RSJs, goalposts)
- Labour/material split with configurable ratios
- Overhead & profit margins
- Second goalpost allowance logic

### Storage (`src/lib/storage.ts`)

- Primary persistence: `localStorage` under key `daylog_project`
- Legacy migration: reads old `roomworks_*` keys and promotes them
- Snapshots: up to 30 saved states under `daylog_snapshots`
- Full backup: JSON file download/upload via browser
- Templates: stored under `daylog_templates`

## App Architecture

`App.tsx` is a single large component managing all application state with `useState`. There is no router library — screen navigation is handled by a `currentScreen` state variable. Screens include:

- `dashboard` — project list
- `room` — room detail / work item editor
- `summary` — cost summary across all rooms
- `sections` — section-based view
- `extension` — extension quote calculator
- `saves` — snapshot management

**Autosave** runs on a 5-minute `setInterval` and saves to localStorage.

## Import/Export

- **Project JSON** — single project export/import via `importValidation.ts`
- **Full backup JSON** — all projects, templates, and snapshots
- **CSV** — line items export via `csv.ts`

## Conventions

- Keep calculation logic in `src/lib/` — not in `App.tsx`
- Pure functions for all calculations — no side effects
- Manual overrides on `WorkItem` use `qtyOverride` and `rateOverride` fields; always check these before computed values
- All monetary values are in GBP (£); quantities use metric units (m², lm, etc.)
- The app is labour-only — material costs are intentionally excluded
- Door counts are per-room, not per-wall

## Backup Workflow

The `backups/main-backup.json` file is committed to the repo. To update it:

1. Export a full backup from the app UI
2. Place the downloaded file in `~/Downloads/` with name matching `daylog-project-*.json`
3. Run `npm run backup:push` — this finds the latest backup, commits it, and pushes to the current branch

To restore:
1. Run `npm run backup:pull` — pulls latest from GitHub and copies to Downloads
2. Import the file via the app's restore UI
