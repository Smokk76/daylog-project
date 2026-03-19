# CLAUDE.md — DayLog Project Guide

This file documents the DayLog codebase for AI assistants. Read it before making changes.

---

## Project Overview

**DayLog** is a browser-based construction estimating tool (formerly called RoomWorks). It helps contractors calculate labour costs for renovation projects room-by-room and generate building extension quotes.

- **Stack**: React 18 + TypeScript, Vite bundler, zero runtime dependencies beyond React
- **Storage**: Browser `localStorage` only — no backend, no database, no API calls
- **Tests**: Node.js built-in test runner with `tsx` for TypeScript execution
- **Entry point**: `src/main.tsx` → `src/App.tsx`

---

## Directory Structure

```
daylog-project/
├── src/
│   ├── App.tsx                  # Entire UI (3368 lines, monolithic)
│   ├── main.tsx                 # React DOM mount point
│   ├── styles.css               # Global styles
│   ├── types.ts                 # All TypeScript interfaces
│   ├── data/
│   │   └── defaults.ts          # Default values, 11 modules, sample rooms, normalizeProjectData()
│   └── lib/
│       ├── calculations.ts      # Core quantity/cost calculation engine (pure functions)
│       ├── extensionCalculations.ts  # Building extension quote calculator
│       ├── csv.ts               # CSV export + download trigger
│       ├── importValidation.ts  # Import schema validation
│       └── storage.ts           # localStorage read/write with legacy migration
├── tests/
│   ├── calculations.test.ts
│   ├── extensionCalculations.test.ts
│   ├── importValidation.test.ts
│   ├── normalizeProjectData.test.ts
│   └── storageUiPrefs.test.ts
├── scripts/
│   ├── backup-push.sh           # Push JSON backup to GitHub
│   └── backup-pull.sh           # Pull backup from GitHub
├── backups/
│   └── main-backup.json         # Latest committed backup (~6MB)
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Available Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # tsc + Vite build → dist/
npm run preview      # Preview built dist/
npm test             # Run all tests once
npm run test:watch   # Run tests in watch mode
npm run backup:push  # Push latest backup to GitHub
npm run backup:pull  # Pull backup from GitHub to ~/Downloads/
```

Tests use Node's built-in runner: `node --import tsx --test tests/**/*.test.ts`

---

## Architecture

### App.tsx — Monolithic UI

All UI logic lives in a single 3368-line component. There are six screens managed by local state:

| Screen | Purpose |
|--------|---------|
| `dashboard` | Room list grouped by level with cost summary |
| `room` | Room dimensions + work item checklist |
| `summary` | Category totals + CSV export |
| `sections` | Work item module editor |
| `extension` | Building extension quote calculator |
| `saves` | Backup/restore + project templates |

Key features in App.tsx:
- 5-minute autosave with delta-based snapshots (max 30 stored)
- Room presets (Bedroom, Hall/Corridor, Landing, Reception, Custom)
- Work item visibility toggles per module per room
- Manual overrides for dimensions, quantities, and rates
- UI preferences persistence (collapsed panels)

### Data Flow

```
localStorage
    ↓ loadProject()
ProjectData (in-memory state)
    ↓
computeRoom() → RoomComputed (derived geometry)
    ↓
buildLineItems() → LineItemTotal[]
    ↓
summaryTotals() → grand total + per-category breakdown
    ↓ saveProject()
localStorage
```

### Calculation Engine (`lib/calculations.ts`)

All functions are pure — no side effects:

- **`computeRoom(room, settings)`** — derives `floorArea`, `ceilingArea`, `wallArea`, `skirtingLM`, `architraveLM`, `perimeterM` from `L × W × ceilingH` and door count. Respects manual overrides.
- **`baseQtyFromSource()`** — maps a `QuantitySource` string to the correct computed value
- **`getRateForWork()`** — looks up rate key in `settings.unitRatesGBP`, respects per-selection overrides
- **`getQtyForWork()`** — returns quantity with manual override support
- **`buildLineItems()`** — flat `LineItemTotal[]` combining room-scope and project-scope items
- **`roomTotals()`** — cost sum + man-days per room (cost / dayRate)
- **`summaryTotals()`** — grand total excluding `excludeFromTotals` rooms, breakdown by `WorkCategory`

### Extension Calculator (`lib/extensionCalculations.ts`)

`calculateExtensionQuote(quote)` returns an `ExtensionSummary` with:
- Foundations (skip + concrete + labour, hand-dig vs mini-digger)
- Walls (under-DPC and above-DPC pricing separately)
- Floor screed
- Roof (base rate × finish factor)
- Structural steel
- Overhead + profit with optional main contractor markup

Labour/material split percentages differ per category (foundations 40%, walls 45-50%, roof 50%).

### Storage (`lib/storage.ts`)

All data goes to `localStorage`. Keys use `daylog-project-*-v1` prefix.

**Legacy migration**: Automatically reads from old `roomworks-estimator-*-v1` keys on first load (one-time migration).

| Function | Key | Purpose |
|----------|-----|---------|
| `loadProject()` / `saveProject()` | `daylog-project-v1` | Main project data |
| `loadSnapshots()` / `saveSnapshot()` | `daylog-project-snapshots-v1` | Up to 30 autosave snapshots |
| `loadUiPrefs()` / `saveUiPrefs()` | `daylog-project-ui-prefs-v1` | Collapsed panel state |
| `loadProjectTemplates()` / `saveProjectTemplate()` | `daylog-project-templates-v1` | Saved project templates |
| `createFullBackup()` / `applyFullBackup()` | — | Serialize/deserialize all keys to/from JSON |

---

## Data Models (key types from `src/types.ts`)

```typescript
ProjectData {
  info: { clientName, address, description, date }
  settings: ProjectSettings  // dayRateGBP, ceilingHeightM, 58 unit rates
  rooms: Room[]              // id, name, level, lengthM, widthM, doorCount, excludeFromTotals
  workItems: WorkItem[]      // id, name, unitType, quantitySource, defaultRateKey, category, scope, moduleId
  selections: RoomWorkSelection[]  // roomId, workItemId, qtyOverride, rateOverride, isSelected, isDone, notes
  sections: ProjectSection[] // ordered list of modules
  extensionQuote: ExtensionQuote
  projectTemplates: ProjectTemplate[]
  extensionTemplates: ExtensionQuoteTemplate[]
}
```

**`WorkScope`**: `"room"` | `"project"` — project-scope items (e.g. scaffold, mobilisation) appear once in Summary, not per room.

**`QuantitySource`**: `"floorArea"` | `"ceilingArea"` | `"wallArea"` | `"skirtingLM"` | `"architraveLM"` | `"doorCount"` | `"manual"` — determines how a work item's quantity is auto-calculated.

**`Level`**: `"Lower Ground Floor / Basement"` | `"Ground Floor"` | `"First Floor"` | `"Second Floor"` | `"Loft"`

**`UnitType`**: `"m2"` | `"lm"` | `"each"` | `"fixed"`

### Default Modules (11 total, defined in `data/defaults.ts`)

1. Enabling works (demolition)
2. Site Overheads (scaffold, portable toilet, mobilisation — all project-scope)
3. Internal Joinery (skirting, architraves, doors)
4. Plastering & Insulation
5. Electrical
6. Heating
7. Plumbing
8. Floor Finishes
9. Tiling
10. Painting & Decorating
11. Miscellaneous

---

## Key Conventions

### Calculations
- All costs are **labour-only** (no materials) — this is core to the app's philosophy
- Day rate defaults to £185/day
- Man-days = cost / dayRateGBP
- Excluded rooms (bathrooms, kitchens etc.) are tracked but omitted from grand totals
- `normalizeProjectData()` in `defaults.ts` must be called on every loaded project to repair legacy data, fill missing defaults, and migrate old scope/moduleId values

### TypeScript
- Strict mode is enabled — no implicit `any`
- All interfaces are in `src/types.ts` — add new types there
- No external UI libraries — all components are custom in App.tsx
- Use `tsx` for running `.ts` files directly (not `ts-node`)

### Testing
- Tests use Node's built-in `node:test` runner and `node:assert/strict`
- Import with `import { describe, it } from 'node:test'`
- Test files live in `tests/` and match `*.test.ts`
- Run with `npm test` (single pass) or `npm run test:watch`
- Test pure functions from `lib/` and `data/`; App.tsx is not unit-tested

### Git & Branching
- Feature branches: `claude/<description>-<sessionId>`
- Push with: `git push -u origin <branch-name>`
- The `master` branch is the main branch (not `main`)
- The backup file `backups/main-backup.json` is committed and tracked in git

### No Linting/Formatting Config
- No ESLint or Prettier config exists — follow the existing code style manually
- Use 2-space indentation, single quotes, no trailing semicolons (match existing files)

---

## Common Tasks

### Adding a new work item
1. Add a `WorkItem` entry to the appropriate module array in `data/defaults.ts` → `defaultModules`
2. If it needs a new rate, add the rate key to `UnitRatesGBP` in `types.ts` and the default value in `defaultSettings.unitRatesGBP`
3. Ensure `normalizeProjectData()` will add it to existing projects (it merges defaults with loaded data)

### Adding a new screen
1. Add a new value to the screen state union in `App.tsx`
2. Add navigation in the header/nav section
3. Render the screen in the main switch/conditional block

### Modifying calculation logic
1. Edit the relevant pure function in `lib/calculations.ts` or `lib/extensionCalculations.ts`
2. Add/update tests in `tests/calculations.test.ts` or `tests/extensionCalculations.test.ts`
3. Run `npm test` to verify

### Changing data shape / adding fields
1. Update interface in `src/types.ts`
2. Add default value in `data/defaults.ts`
3. Update `normalizeProjectData()` to handle missing field on old saved data (backward compat)
4. Update `importValidation.ts` if the field is required for import

### Running a full backup/restore
- **Push**: `npm run backup:push` (or `bash scripts/backup-push.sh /path/to/backup.json`)
- **Pull**: `npm run backup:pull` → copies to `~/Downloads/` with timestamp

---

## What NOT to Do

- **Don't add a backend** — this is intentionally localStorage-only
- **Don't split App.tsx prematurely** — the monolithic structure is intentional; only refactor if explicitly asked
- **Don't add UI libraries** (Tailwind, MUI, etc.) without explicit request — all styling is custom CSS
- **Don't add a linter/formatter** without explicit request — no config exists
- **Don't skip `normalizeProjectData()`** when loading project data — it handles all legacy migration
- **Don't hardcode rates** — all rates live in `settings.unitRatesGBP` and are user-configurable
- **Don't add environment variables** — there are none; all config is in `defaults.ts` or the UI
