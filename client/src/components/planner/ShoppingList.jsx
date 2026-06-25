import React, { useMemo } from 'react';
import { Copy, X } from 'lucide-react';
import { MEAL_TYPES, cellId } from '../../utils/weekUtils.js';
import { categorizeIngredient, CATEGORIES } from '../../utils/categoryUtils.js';
import Modal from '../common/Modal.jsx';

function buildList(mealPlan, recipes, pantry) {
  const totals = {};

  for (let day = 0; day < 7; day++) {
    for (const meal of MEAL_TYPES) {
      const id = cellId(day, meal);
      for (const item of (mealPlan[id] || [])) {
        if (item.type !== 'recipe') continue;
        const recipe = recipes.find(r => r.id === item.recipeId);
        if (!recipe?.ingredients) continue;
        for (const ing of recipe.ingredients) {
          const key = ing.name.toLowerCase().trim();
          if (!totals[key]) totals[key] = { ...ing, quantity: 0 };
          totals[key].quantity += parseFloat(ing.quantity) || 0;
        }
      }
    }
  }

  // Deduct pantry
  for (const p of pantry) {
    const key = p.name.toLowerCase().trim();
    if (totals[key]) {
      totals[key].quantity -= parseFloat(p.quantity) || 0;
      if (totals[key].quantity <= 0) delete totals[key];
    }
  }

  // Group by category
  const grouped = {};
  for (const item of Object.values(totals)) {
    const cat = categorizeIngredient(item.name);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  return grouped;
}

function toPlainText(grouped) {
  return CATEGORIES
    .filter(cat => grouped[cat]?.length)
    .map(cat => {
      const lines = grouped[cat].map(i => `  - ${i.name}: ${i.quantity > 0 ? `${i.quantity} ${i.unit}` : i.unit || ''}`).join('\n');
      return `${cat}:\n${lines}`;
    })
    .join('\n\n');
}

export default function ShoppingList({ onClose, mealPlan, recipes, pantry }) {
  const grouped = useMemo(() => buildList(mealPlan, recipes, pantry), [mealPlan, recipes, pantry]);
  const isEmpty = Object.keys(grouped).length === 0;

  const copyToClipboard = () => {
    navigator.clipboard.writeText('Shopping List\n\n' + toPlainText(grouped));
  };

  return (
    <Modal title="Shopping List" onClose={onClose} size="md">
      <div className="space-y-4">
        {isEmpty ? (
          <p className="text-slate-500 text-sm text-center py-6">
            No items needed — pantry covers everything or no meals planned.
          </p>
        ) : (
          <>
            <button onClick={copyToClipboard} className="btn-ghost w-full justify-center border border-border">
              <Copy size={14} /> Copy as plain text
            </button>
            {CATEGORIES.filter(cat => grouped[cat]?.length).map(cat => (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{cat}</h3>
                <div className="space-y-1">
                  {grouped[cat].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                      <span className="text-sm text-slate-200">{item.name}</span>
                      <span className="text-xs text-slate-400">
                        {item.quantity > 0 ? `${Math.round(item.quantity * 10) / 10} ${item.unit}` : item.unit || ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}
