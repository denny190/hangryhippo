# FuelOS

A personal nutrition tracking app — self-hostable, mobile-first, dark-themed. No external services, no authentication required. All data stored in a single `db.json` file.

## Features

- **Weekly Meal Planner** — drag-and-drop recipe slots across a Mon–Sun × Breakfast/Lunch/Dinner/Snack grid
- **Recipe Database** — full CRUD with macros, ingredients, batch-cook flag, gut-friendly tag
- **Pantry Tracker** — track what you have at home; auto-deduct when you mark a recipe cooked
- **Pantry Match %** — recipes ranked by how many ingredients you already have
- **Shopping List** — auto-generated from the week's plan, deducted against pantry, grouped by category
- **Daily & Weekly Summary** — macro progress bars, weekly kcal bar chart, radar chart
- **Quick Log** — log a free-text meal with manual macros, no recipe needed
- **Day Notes** — energy, digestion, mood notes per calendar day
- **Settings** — set macro targets, export/import full JSON backup

## Quick start

### Prerequisites

- Node.js 18+

### Install

```bash
cd fuelos
npm run install:all
```

### Dev (hot reload)

```bash
npm run dev
```

Opens the React dev server on **http://localhost:5173** (proxies `/api` to the Express backend on port 3001).

### Production

```bash
npm run build        # builds the React app into client/dist/
npm start            # serves everything from a single node process on port 3001
```

Then visit **http://localhost:3001**.

## Data

Everything lives in `db.json` at the project root. Back it up with the **Export** button in Settings, or by copying the file directly.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3001`  | Port the Express server listens on |

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS v3 |
| Drag & drop | @dnd-kit/core |
| Charts | Recharts |
| Icons | Lucide React |
| Backend | Node.js, Express |
| Storage | Plain JSON file (`db.json`) |
| Dev runner | concurrently + nodemon |
