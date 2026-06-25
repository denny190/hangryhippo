const BASE = '/api';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}`);
  return res.json();
}

export const api = {
  // Recipes
  getRecipes: () => req('GET', '/recipes'),
  createRecipe: (data) => req('POST', '/recipes', data),
  updateRecipe: (id, data) => req('PUT', `/recipes/${id}`, data),
  deleteRecipe: (id) => req('DELETE', `/recipes/${id}`),

  // Foods (ingredient database)
  getFoods: () => req('GET', '/foods'),
  createFood: (data) => req('POST', '/foods', data),
  updateFood: (id, data) => req('PUT', `/foods/${id}`, data),
  deleteFood: (id) => req('DELETE', `/foods/${id}`),

  // Pantry
  getPantry: () => req('GET', '/pantry'),
  createPantryItem: (data) => req('POST', '/pantry', data),
  updatePantryItem: (id, data) => req('PUT', `/pantry/${id}`, data),
  deletePantryItem: (id) => req('DELETE', `/pantry/${id}`),

  // Meal plans
  getMealPlan: (week) => req('GET', `/mealplan/${week}`),
  saveMealPlan: (week, data) => req('PUT', `/mealplan/${week}`, data),

  // Notes
  getNote: (date) => req('GET', `/notes/${date}`),
  saveNote: (date, note) => req('PUT', `/notes/${date}`, { note }),

  // Settings
  getSettings: () => req('GET', '/settings'),
  saveSettings: (data) => req('PUT', '/settings', data),

  // Import/Export
  async exportDb() {
    const res = await fetch(`${BASE}/export`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fuelos-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  },
  importDb: (data) => req('POST', '/import', data),
};

// ── Macro helpers ──────────────────────────────────────────────────────────

/**
 * Scale a food DB item's macros to a given quantity.
 * food.per is the reference quantity (e.g. 100), food.unit is the unit.
 */
export function scaleFoodMacros(food, quantity) {
  const qty = parseFloat(quantity) || 0;
  const base = parseFloat(food.per) || 100;
  const scale = qty / base;
  return {
    kcal:    (food.kcal    || 0) * scale,
    protein: (food.protein || 0) * scale,
    carbs:   (food.carbs   || 0) * scale,
    fat:     (food.fat     || 0) * scale,
  };
}

/**
 * Auto-calculate recipe macros from its ingredient list + the foods DB.
 * Ingredients with no foodId contribute 0.
 */
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

export function getMacrosForItems(items, recipes) {
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

export function getPantryMatch(recipe, pantry) {
  if (!recipe.ingredients?.length) return 100;
  const pantryNames = pantry.map(p => p.name.toLowerCase().trim());
  const matched = recipe.ingredients.filter(ing => {
    const n = ing.name.toLowerCase().trim();
    return pantryNames.some(p => p.includes(n) || n.includes(p));
  }).length;
  return Math.round((matched / recipe.ingredients.length) * 100);
}

export function getMissingIngredients(recipe, pantry) {
  if (!recipe.ingredients?.length) return [];
  const pantryNames = pantry.map(p => p.name.toLowerCase().trim());
  return recipe.ingredients.filter(ing => {
    const n = ing.name.toLowerCase().trim();
    return !pantryNames.some(p => p.includes(n) || n.includes(p));
  });
}
