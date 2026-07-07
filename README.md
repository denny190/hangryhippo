# FuelOS

A personal nutrition tracker — mobile-first, dark-themed, self-hostable. Track meals, scan barcodes, plan your week, and review daily summaries with trend analytics.

## Features

- **Weekly Meal Planner** — drag-and-drop (or tap-to-select) across a Mon–Sun × Breakfast/Lunch/Dinner/Snack grid
- **Recipes + Foods** — full CRUD with auto-calculated macros from linked ingredients; per-portion scaling
- **Planner picker** — add recipes, individual foods with quantity, or custom macro entries directly to any slot
- **Barcode scanner** — scan EAN/UPC barcodes or search by name via Open Food Facts; scan straight into a meal slot
- **Daily Summary** — macro progress bars, target-coverage radar chart, day notes
- **7-day analytics** — average kcal/protein over a rolling 7-day window, protein streak counter
- **Historical navigation** — step through past days in Summary; bar chart highlights the selected day
- **Shopping list** — auto-generated from the week's planned recipes
- **Quick log** — log a restaurant meal or anything else with manual macros, no recipe needed
- **Export / Import** — full JSON backup from Settings

---

## Local development

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
# from the repo root
npm run install:all
```

This runs `npm install` for both the root (Express) and `client/` (Vite + React).

### Run

```bash
npm run dev
```

Starts two processes in parallel via `concurrently`:

| Process | URL | Notes |
|---------|-----|-------|
| Express backend | `http://localhost:3001` | REST API + Open Food Facts proxy |
| Vite dev server | `http://localhost:5173` | React app, hot reload, proxies `/api` → 3001 |

Open **http://localhost:5173** in your browser.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Express listening port |

Create a `.env` file at the project root if you need to override:

```
PORT=3001
```

---

## Self-hosted deployment (single user)

This is the simplest path — one process serves both the API and the built frontend.

### Build

```bash
npm run build        # compiles client/src → client/dist/
```

### Run in production

```bash
NODE_ENV=production npm start
```

Express serves the static `client/dist/` files and the `/api` routes from a single process on `PORT` (default 3001). Visit **http://your-server:3001**.

### Platforms

#### Render.com (free tier)

1. Push the repo to GitHub.
2. New **Web Service** → connect repo → set:
   - **Build command:** `npm run install:all && npm run build`
   - **Start command:** `npm start`
   - **Environment:** Node
3. Add env var `PORT=10000` (Render assigns this automatically via `$PORT`).
4. Deploy. Render provides a public HTTPS URL.

> **Data persistence:** Render's free tier has an ephemeral filesystem — `db.json` resets on each deploy. Upgrade to a paid plan with a persistent disk, or migrate to Supabase (see below).

#### Railway / Fly.io / any VPS

Same principle — install, build, then `npm start`. Set `PORT` to whatever the platform expects. For a VPS, run behind nginx with a reverse proxy and use `pm2` to keep the process alive:

```bash
npm install -g pm2
pm2 start server.js --name fuelos
pm2 save
pm2 startup
```

---

## Multi-user cloud deployment (GitHub Pages + Supabase)

> **Status:** planned — see `Feature 4` in the development plan. Steps below are a guide for when that migration is complete.

This architecture replaces the Express backend entirely:

```
Browser  (GitHub Pages — free static hosting)
  └── @supabase/supabase-js
        ├── Supabase Auth    — email/password login, session management
        ├── Supabase Postgres — recipes, foods, meal plans, notes, settings
        │   └── Row Level Security — users can only read/write their own rows
        └── Supabase Edge Functions — Open Food Facts barcode + search proxy
```

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Open the **SQL editor** and run the schema:

```sql
create table recipes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,
  meal_type   text,
  ingredients jsonb default '[]',
  macros      jsonb default '{}',
  prep_notes  text,
  portions    int default 1,
  created_at  timestamptz default now()
);

create table foods (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid references auth.users(id) on delete cascade,
  name     text not null,
  per      numeric, unit text,
  kcal     numeric, protein numeric, carbs numeric, fat numeric,
  code     text
);

create table meal_plans (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid references auth.users(id) on delete cascade,
  week     text not null,
  data     jsonb default '{}',
  unique(user_id, week)
);

create table notes (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid references auth.users(id) on delete cascade,
  date     text not null,
  note     text,
  unique(user_id, date)
);

create table settings (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid references auth.users(id) on delete cascade,
  targets  jsonb default '{"kcal":2000,"protein":150,"carbs":200,"fat":65}',
  unique(user_id)
);

-- Enable Row Level Security
alter table recipes    enable row level security;
alter table foods      enable row level security;
alter table meal_plans enable row level security;
alter table notes      enable row level security;
alter table settings   enable row level security;

-- Each user sees only their own rows
create policy "own rows only" on recipes    for all using (auth.uid() = user_id);
create policy "own rows only" on foods      for all using (auth.uid() = user_id);
create policy "own rows only" on meal_plans for all using (auth.uid() = user_id);
create policy "own rows only" on notes      for all using (auth.uid() = user_id);
create policy "own rows only" on settings   for all using (auth.uid() = user_id);
```

3. Find your **Project URL** and **anon key** in Settings → API.

### 2. Configure the frontend

Create `client/.env.production`:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

The anon key is safe to expose — RLS prevents any cross-user data access at the database level.

### 3. Deploy to GitHub Pages

Add a GitHub Actions workflow at `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci --prefix client
      - run: npm run build --prefix client
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./client/dist
```

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository secrets (Settings → Secrets → Actions).

If the repo is at `github.com/you/fuelos`, set `base: '/fuelos/'` in `client/vite.config.js`. For a custom domain or user Pages (`you.github.io`), use `base: '/'`.

### 4. Migrate existing data

Use the **Export** button in Settings to download `fuelos-backup.json`, then use **Import** to load it into the new Supabase-backed deployment. The import route upserts all rows into Supabase tables rather than writing to `db.json`.

---

## Data

### Local / self-hosted

Everything lives in `db.json` at the project root. Back it up any time with the **Export** button in Settings (downloads a `fuelos-backup.json`), or by copying the file directly. To restore, use **Import** in Settings.

### Supabase

Data is stored in Postgres. The export/import flow in Settings works the same way — it serialises the in-memory state to JSON on export, and upserts all rows on import.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite 5, Tailwind CSS v3 |
| Drag & drop | @dnd-kit/core |
| Charts | Recharts |
| Icons | Lucide React |
| Backend (local) | Node.js 18, Express 4 |
| Storage (local) | `db.json` — plain JSON file |
| Storage (cloud) | Supabase Postgres + Auth + RLS |
| Barcode / search | Open Food Facts (proxied via Express or Supabase Edge Functions) |
| Dev tooling | concurrently, nodemon |
