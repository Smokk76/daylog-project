# RoomWorks Estimator (MVP)

Single-page React + TypeScript app for UK residential labour-only room estimating.

## Features
- Project dashboard with rooms grouped by level
- Room detail editor with live recalculation from dimensions
- Work checklist by category with include/done toggles
- Quantity and rate overrides per room/work line
- Day-rate based man-days
- Rates/settings editor and reset-to-defaults
- Summary with totals by room/category
- Export summary CSV
- Export/import full project JSON
- Local storage persistence
- Preloaded sample project including excluded Kitchen/Bathroom/Conservatory

## Run locally
1. `cd /Users/igorkaminski/Documents/codex/roomworks-estimator`
2. `npm install`
3. `npm run dev`
4. Open the local URL shown by Vite

## Tests
- Run once: `npm test`
- Watch mode: `npm run test:watch`

Unit tests cover key calculation functions (areas, totals, man-days) and run using Node's built-in test runner.

## GitHub backup flow
Use this if you want a backup copy stored in your GitHub repo.

1. In the app Saves screen, click `Export Full Backup`.
2. Run `npm run backup:push` to copy the newest backup from Downloads to `backups/main-backup.json`, commit, and push.
3. On a new machine, run `npm run backup:pull` to pull from GitHub and copy backup JSON into Downloads.
4. In the app Saves screen, click `Import Full Backup`.

You can also pass a specific file to push:
- `npm run backup:push -- "/absolute/path/to/roomworks-estimator-full-backup.json"`

## Help: Backup and Recovery Manual

### 1) Push full backup to GitHub (most important)
Use this when you want a safe copy in GitHub in case your laptop is lost.

1. Open the app and go to Saves.
2. Click `Export Full Backup`.
3. In Terminal run:
   - `cd /Users/igorkaminski/Documents/codex/roomworks-estimator`
   - `npm run backup:push -- "/Users/igorkaminski/Downloads/roomworks-estimator-full-backup.json"`
4. This updates `backups/main-backup.json`, commits, and pushes to GitHub.

Tip: if your downloaded filename is different, use that exact file path.

### 2) Pull full backup from GitHub (new laptop / recovery)
Use this to restore the backup from GitHub onto a machine.

1. In Terminal run:
   - `cd /Users/igorkaminski/Documents/codex/roomworks-estimator`
   - `npm run backup:pull`
2. This pulls from GitHub and copies a restore file into Downloads:
   - `roomworks-estimator-restored-YYYY-MM-DD_HH-MM-SS.json`
3. Open the app and click `Import Full Backup` in Saves.
4. Select that restored file from Downloads.

### 3) What full backup includes
`Export Full Backup` includes:
- current project data
- autosave snapshots
- project templates
- UI preferences (collapsed/expanded panels)

### 4) Autosave snapshots vs full backup
- Autosave snapshots:
  - stored only in browser local storage for one origin (for example `http://localhost:5173`)
  - good for quick undo
  - can be lost if browser storage is cleared or overwritten
- Full backup JSON:
  - saved as a file you can keep and move
  - can be pushed to GitHub with `npm run backup:push`
  - best for long-term recovery and new-computer restore

### 5) Which one to use
- Need to undo a recent change quickly: use Snapshot `Restore`.
- Need durable safety copy: use `Export Full Backup` and `backup:push`.
- Setting up on a new machine: use `backup:pull` then `Import Full Backup`.

### 6) Recommended routine (simple)
1. After important edits, click `Export Full Backup`.
2. Run `npm run backup:push`.
3. Keep working.

### 7) Recovery drill (2 minutes)
Practice this once so recovery is easy under pressure.

1. In Terminal:
   - `cd /Users/igorkaminski/Documents/codex/roomworks-estimator`
   - `npm run backup:pull`
2. Start app:
   - `npm run dev -- --host --port 5173 --strictPort`
3. Open `http://localhost:5173`, go to Saves, click `Import Full Backup`.
4. Select the restored file from Downloads (`roomworks-estimator-restored-...json`).
5. Confirm data appears:
   - project totals
   - templates list
   - snapshots list

## Notes
- All figures are labour-only.
- Doors are per-room manual counts; presets enforce hallway/landing default to 0.
- Quantity recalculates automatically when dimensions change, unless that line has manual quantity override.
