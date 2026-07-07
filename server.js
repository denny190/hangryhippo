const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const defaultDb = {
  recipes: [],
  foods: [],
  mealPlans: {},
  notes: {},
  settings: { targets: { kcal: 2000, protein: 150, carbs: 200, fat: 65 } },
};

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultDb, null, 2));
      return { ...defaultDb };
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return { ...defaultDb };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ── Recipes ────────────────────────────────────────────────────────────────
app.get('/api/recipes', (req, res) => res.json(readDb().recipes));

app.post('/api/recipes', (req, res) => {
  const db = readDb();
  const recipe = { ...req.body, id: uuidv4() };
  db.recipes.push(recipe);
  writeDb(db);
  res.status(201).json(recipe);
});

app.put('/api/recipes/:id', (req, res) => {
  const db = readDb();
  const idx = db.recipes.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.recipes[idx] = { ...req.body, id: req.params.id };
  writeDb(db);
  res.json(db.recipes[idx]);
});

app.delete('/api/recipes/:id', (req, res) => {
  const db = readDb();
  db.recipes = db.recipes.filter(r => r.id !== req.params.id);
  writeDb(db);
  res.json({ ok: true });
});

// ── Foods (ingredient database) ───────────────────────────────────────────
app.get('/api/foods', (req, res) => res.json(readDb().foods || []));

app.post('/api/foods', (req, res) => {
  const db = readDb();
  if (!db.foods) db.foods = [];
  const item = { ...req.body, id: uuidv4() };
  db.foods.push(item);
  writeDb(db);
  res.status(201).json(item);
});

app.put('/api/foods/:id', (req, res) => {
  const db = readDb();
  if (!db.foods) db.foods = [];
  const idx = db.foods.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.foods[idx] = { ...req.body, id: req.params.id };
  writeDb(db);
  res.json(db.foods[idx]);
});

app.delete('/api/foods/:id', (req, res) => {
  const db = readDb();
  db.foods = (db.foods || []).filter(f => f.id !== req.params.id);
  writeDb(db);
  res.json({ ok: true });
});

// ── Meal Plans ─────────────────────────────────────────────────────────────
app.get('/api/mealplan/:week', (req, res) => {
  const db = readDb();
  res.json(db.mealPlans[req.params.week] || {});
});

app.put('/api/mealplan/:week', (req, res) => {
  const db = readDb();
  db.mealPlans[req.params.week] = req.body;
  writeDb(db);
  res.json(db.mealPlans[req.params.week]);
});

// ── Notes ──────────────────────────────────────────────────────────────────
app.get('/api/notes/:date', (req, res) => {
  const db = readDb();
  res.json({ note: db.notes[req.params.date] || '' });
});

app.put('/api/notes/:date', (req, res) => {
  const db = readDb();
  db.notes[req.params.date] = req.body.note || '';
  writeDb(db);
  res.json({ note: db.notes[req.params.date] });
});

// ── Settings ───────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => res.json(readDb().settings));

app.put('/api/settings', (req, res) => {
  const db = readDb();
  db.settings = req.body;
  writeDb(db);
  res.json(db.settings);
});

// ── Barcode lookup (proxied to Open Food Facts) ───────────────────────────
app.get('/api/barcode/:code', async (req, res) => {
  try {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(req.params.code)}.json`,
      { headers: { 'User-Agent': 'FuelOS/1.0 (self-hosted nutrition tracker)' } }
    );
    const json = await r.json();
    if (json.status !== 1 || !json.product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const p = json.product;
    const n = p.nutriments || {};
    const kcal = n['energy-kcal_100g'] ?? n['energy-kcal'] ??
      (n['energy_100g'] ? Math.round(n['energy_100g'] / 4.184) : 0);
    res.json({
      name: p.product_name_en || p.product_name || '',
      per: 100,
      unit: 'g',
      kcal:    Math.round(kcal               || 0),
      protein: Math.round((n['proteins_100g']       || 0) * 10) / 10,
      carbs:   Math.round((n['carbohydrates_100g']  || 0) * 10) / 10,
      fat:     Math.round((n['fat_100g']            || 0) * 10) / 10,
    });
  } catch (e) {
    res.status(500).json({ error: 'Lookup failed — check your internet connection.' });
  }
});

// ── Food name search (proxied to Open Food Facts) ─────────────────────────
app.get('/api/search/food', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=12&fields=product_name,product_name_en,brands,nutriments`;
    const r = await fetch(url, { headers: { 'User-Agent': 'FuelOS/1.0 (self-hosted nutrition tracker)' } });
    const data = await r.json();
    const results = (data.products || [])
      .filter(p => {
        const name = p.product_name_en || p.product_name;
        const n = p.nutriments || {};
        return name && (n['energy-kcal_100g'] != null || n['energy_100g'] != null);
      })
      .slice(0, 8)
      .map(p => {
        const name  = (p.product_name_en || p.product_name || '').trim();
        const brand = p.brands ? p.brands.split(',')[0].trim() : '';
        const n = p.nutriments || {};
        const kcal = n['energy-kcal_100g'] ?? Math.round((n['energy_100g'] || 0) / 4.184);
        return {
          name:    brand ? `${name} (${brand})` : name,
          per:     100,
          unit:    'g',
          kcal:    Math.round(kcal || 0),
          protein: Math.round((n['proteins_100g']      || 0) * 10) / 10,
          carbs:   Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
          fat:     Math.round((n['fat_100g']           || 0) * 10) / 10,
        };
      });
    res.json(results);
  } catch {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── Export / Import ────────────────────────────────────────────────────────
app.get('/api/export', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="fuelos-backup.json"');
  res.json(readDb());
});

app.post('/api/import', (req, res) => {
  try {
    writeDb(req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// ── Serve built frontend ───────────────────────────────────────────────────
const distPath = path.join(__dirname, 'client/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`\n  FuelOS running on http://localhost:${PORT}\n`);
});
