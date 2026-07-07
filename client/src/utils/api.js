import { supabase } from '../lib/supabase.js';

// ── Auth helper ────────────────────────────────────────────────────────────

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
}

// ── Open Food Facts — normalizes a product object to our internal shape ────

function normalizeOFFProduct(p) {
  const n = p.nutriments || {};
  const kcal = n['energy-kcal_100g'] ?? n['energy-kcal'] ??
    (n['energy_100g'] ? Math.round(n['energy_100g'] / 4.184) : 0);
  return {
    name:    (p.product_name_en || p.product_name || '').trim(),
    per:     100,
    unit:    'g',
    kcal:    Math.round(kcal || 0),
    protein: Math.round((n['proteins_100g']      || 0) * 10) / 10,
    carbs:   Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
    fat:     Math.round((n['fat_100g']           || 0) * 10) / 10,
  };
}

// ── API ────────────────────────────────────────────────────────────────────

export const api = {
  // Recipes
  getRecipes: async () => {
    const { data } = await supabase.from('recipes').select('*').order('created_at');
    return data ?? [];
  },
  createRecipe: async (body) => {
    const { data } = await supabase.from('recipes')
      .insert({ ...body, user_id: await uid() }).select().single();
    return data;
  },
  updateRecipe: async (id, body) => {
    const { data } = await supabase.from('recipes')
      .update(body).eq('id', id).select().single();
    return data;
  },
  deleteRecipe: async (id) => {
    await supabase.from('recipes').delete().eq('id', id);
    return { ok: true };
  },

  // Foods
  getFoods: async () => {
    const { data } = await supabase.from('foods').select('*').order('name');
    return data ?? [];
  },
  createFood: async (body) => {
    const { data } = await supabase.from('foods')
      .insert({ ...body, user_id: await uid() }).select().single();
    return data;
  },
  updateFood: async (id, body) => {
    const { data } = await supabase.from('foods')
      .update(body).eq('id', id).select().single();
    return data;
  },
  deleteFood: async (id) => {
    await supabase.from('foods').delete().eq('id', id);
    return { ok: true };
  },

  // Meal plans
  getMealPlan: async (week) => {
    const { data } = await supabase.from('meal_plans')
      .select('data').eq('week', week).maybeSingle();
    return data?.data ?? {};
  },
  saveMealPlan: async (week, planData) => {
    await supabase.from('meal_plans')
      .upsert({ week, data: planData, user_id: await uid() }, { onConflict: 'user_id,week' });
  },

  // Notes
  getNote: async (date) => {
    const { data } = await supabase.from('notes')
      .select('note').eq('date', date).maybeSingle();
    return { note: data?.note ?? '' };
  },
  saveNote: async (date, note) => {
    await supabase.from('notes')
      .upsert({ date, note, user_id: await uid() }, { onConflict: 'user_id,date' });
  },

  // Settings
  getSettings: async () => {
    const { data } = await supabase.from('settings').select('*').maybeSingle();
    return data ?? { targets: { kcal: 2000, protein: 150, carbs: 200, fat: 65 } };
  },
  saveSettings: async (body) => {
    const { data } = await supabase.from('settings')
      .upsert({ ...body, user_id: await uid() }, { onConflict: 'user_id' })
      .select().single();
    return data ?? body;
  },

  // Barcode lookup — calls Open Food Facts directly from the browser (CORS supported)
  lookupBarcode: async (code) => {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`,
      { headers: { 'User-Agent': 'FuelOS/1.0' } }
    );
    const json = await r.json();
    if (json.status !== 1 || !json.product) throw new Error('Product not found');
    return { ...normalizeOFFProduct(json.product), code };
  },

  // Food name search — calls Open Food Facts directly from the browser
  searchFood: async (q) => {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=12&fields=product_name,product_name_en,brands,nutriments`;
    const r = await fetch(url, { headers: { 'User-Agent': 'FuelOS/1.0' } });
    const data = await r.json();
    return (data.products || [])
      .filter(p => {
        const name = p.product_name_en || p.product_name;
        const n = p.nutriments || {};
        return name && (n['energy-kcal_100g'] != null || n['energy_100g'] != null);
      })
      .slice(0, 8)
      .map(p => {
        const normalized = normalizeOFFProduct(p);
        const brand = p.brands ? p.brands.split(',')[0].trim() : '';
        return { ...normalized, name: brand ? `${normalized.name} (${brand})` : normalized.name };
      });
  },

  // Export — downloads all user data as JSON
  exportDb: async () => {
    const [recipesRes, foodsRes, plansRes, notesRes, settingsRes] = await Promise.all([
      supabase.from('recipes').select('*'),
      supabase.from('foods').select('*'),
      supabase.from('meal_plans').select('week,data'),
      supabase.from('notes').select('date,note'),
      supabase.from('settings').select('targets').maybeSingle(),
    ]);
    const exportData = {
      recipes:   recipesRes.data  ?? [],
      foods:     foodsRes.data    ?? [],
      mealPlans: Object.fromEntries((plansRes.data ?? []).map(r => [r.week, r.data])),
      notes:     Object.fromEntries((notesRes.data ?? []).map(r => [r.date, r.note])),
      settings:  { targets: settingsRes.data?.targets ?? { kcal: 2000, protein: 150, carbs: 200, fat: 65 } },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'fuelos-backup.json'; a.click();
    URL.revokeObjectURL(url);
  },

  // Import — clears existing data then re-inserts from backup (IDs preserved so recipe→food refs stay intact)
  importDb: async (data) => {
    const userId = await uid();
    await Promise.all([
      supabase.from('recipes').delete().eq('user_id', userId),
      supabase.from('foods').delete().eq('user_id', userId),
      supabase.from('meal_plans').delete().eq('user_id', userId),
      supabase.from('notes').delete().eq('user_id', userId),
    ]);
    const inserts = [];
    if (data.recipes?.length)
      inserts.push(supabase.from('recipes').insert(data.recipes.map(r => ({ ...r, user_id: userId }))));
    if (data.foods?.length)
      inserts.push(supabase.from('foods').insert(data.foods.map(f => ({ ...f, user_id: userId }))));
    const planEntries = Object.entries(data.mealPlans || {});
    if (planEntries.length)
      inserts.push(supabase.from('meal_plans').insert(
        planEntries.map(([week, planData]) => ({ week, data: planData, user_id: userId }))
      ));
    const noteEntries = Object.entries(data.notes || {});
    if (noteEntries.length)
      inserts.push(supabase.from('notes').insert(
        noteEntries.map(([date, note]) => ({ date, note, user_id: userId }))
      ));
    if (data.settings)
      inserts.push(supabase.from('settings')
        .upsert({ ...data.settings, user_id: userId }, { onConflict: 'user_id' }));
    await Promise.all(inserts);
    return { ok: true };
  },
};

// ── Macro helpers ──────────────────────────────────────────────────────────

export function scaleFoodMacros(food, quantity) {
  const qty   = parseFloat(quantity) || 0;
  const base  = parseFloat(food.per) || 100;
  const scale = qty / base;
  return {
    kcal:    (food.kcal    || 0) * scale,
    protein: (food.protein || 0) * scale,
    carbs:   (food.carbs   || 0) * scale,
    fat:     (food.fat     || 0) * scale,
  };
}

export function calcRecipeMacros(ingredients, foods) {
  return (ingredients || []).reduce(
    (acc, ing) => {
      if (!ing.foodId) return acc;
      const food = foods.find(f => f.id === ing.foodId);
      if (!food) return acc;
      const m = scaleFoodMacros(food, ing.quantity);
      acc.kcal    += m.kcal;
      acc.protein += m.protein;
      acc.carbs   += m.carbs;
      acc.fat     += m.fat;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function getMacrosForItems(items, recipes, foods = []) {
  return items.reduce(
    (acc, item) => {
      if (item.type === 'recipe') {
        const r = recipes.find(r => r.id === item.recipeId);
        if (r?.macros) {
          acc.kcal    += r.macros.kcal    || 0;
          acc.protein += r.macros.protein || 0;
          acc.carbs   += r.macros.carbs   || 0;
          acc.fat     += r.macros.fat     || 0;
        }
      } else if (item.type === 'food') {
        const food = foods.find(f => f.id === item.foodId);
        if (food) {
          const m = scaleFoodMacros(food, item.quantity);
          acc.kcal    += m.kcal;
          acc.protein += m.protein;
          acc.carbs   += m.carbs;
          acc.fat     += m.fat;
        }
      } else if (item.type === 'quicklog') {
        acc.kcal    += item.kcal    || 0;
        acc.protein += item.protein || 0;
        acc.carbs   += item.carbs   || 0;
        acc.fat     += item.fat     || 0;
      }
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
