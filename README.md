# Quest Productivity Console

A gamified frontend-only productivity app with a futuristic dark system-interface vibe.

## Features

- Mission-based todo workflow (create, edit, clear, delete)
- Difficulty-based EXP rewards:
  - Easy = 5 EXP
  - Medium = 10 EXP
  - Hard = 20 EXP
- Level and EXP progression bar
- Rank system (E, D, C, B, A, S)
- Daily streak tracking (current and longest)
- Achievement system with unlock checks and popup
- Smart mission filters (All, Active, Cleared, Today, Upcoming)
- Search and sort controls
- Delete + temporary Undo toast action
- Drag-and-drop manual mission ordering
- Separate modules:
  - Quest Board
  - Cleared Quests
  - Achievement Panel
- Full local storage persistence for app state

## Architecture

The app is now split into modules:

- `js/main.js` - bootstrap entry
- `js/controllers/AppController.js` - event wiring + UI orchestration
- `js/store/QuestStore.js` - state, persistence, quest logic
- `js/services/AchievementService.js` - achievement unlock logic
- `js/services/AudioService.js` - sound effects + toggle UI
- `js/services/ToastService.js` - toast/snackbar handling
- `js/services/EffectsService.js` - burst/level visual effects
- `js/config/constants.js` - shared constants
- `js/utils/dateUtils.js` - date helpers

## Run

No build step required, but use a local static server for ES module imports.

1. From project root, run:
   - `python -m http.server 5500`
2. Open:
   - `http://localhost:5500`

## Tech

- HTML
- CSS
- Vanilla JavaScript
