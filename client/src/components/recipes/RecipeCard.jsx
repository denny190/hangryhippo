import React, { useState } from 'react';
import { Edit2, Trash2, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { getPantryMatch, getMissingIngredients } from '../../utils/api.js';

const MEAL_COLORS = {
  breakfast: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  lunch:     'bg-blue-500/15 text-blue-300 border-blue-500/20',
  dinner:    'bg-purple-500/15 text-purple-300 border-purple-500/20',
  snack:     'bg-green-500/15 text-green-300 border-green-500/20',
};

export default function RecipeCard({ recipe, pantry, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const match = getPantryMatch(recipe, pantry);
  const missing = getMissingIngredients(recipe, pantry);

  return (
    <div className="card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-100 truncate">{recipe.name}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className={`badge border ${MEAL_COLORS[recipe.mealType] || MEAL_COLORS.snack}`}>
              {recipe.mealType}
            </span>
            {recipe.portions > 1 && (
              <span className="badge bg-accent/15 text-accent border border-accent/20">
                <Layers size={10} /> {recipe.portions} portions
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} className="btn-ghost p-1.5"><Edit2 size={14} /></button>
          <button onClick={onDelete} className="btn-danger p-1.5"><Trash2 size={14} /></button>
        </div>
      </div>

      {/* Macros */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {[
          { label: 'kcal',    value: recipe.macros?.kcal,    color: 'text-cals' },
          { label: 'protein', value: recipe.macros?.protein, color: 'text-protein' },
          { label: 'carbs',   value: recipe.macros?.carbs,   color: 'text-carbs' },
          { label: 'fat',     value: recipe.macros?.fat,     color: 'text-fat' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/3 rounded-lg py-1.5 px-1">
            <div className={`text-sm font-semibold ${color}`}>{Math.round(value ?? 0)}</div>
            <div className="text-[10px] text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Pantry match */}
      {recipe.ingredients?.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center justify-between w-full text-xs"
          >
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${match === 100 ? 'bg-protein' : match >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${match}%` }}
                />
              </div>
              {match === 100
                ? <span className="text-protein font-medium">In pantry ✓</span>
                : <span className="text-slate-400">{match}% in pantry</span>
              }
            </div>
            {missing.length > 0 && (expanded
              ? <ChevronUp size={12} className="text-slate-500" />
              : <ChevronDown size={12} className="text-slate-500" />
            )}
          </button>
          {expanded && missing.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {missing.map((ing, i) => (
                <span key={i} className="badge bg-red-500/10 text-red-400 border border-red-500/20">
                  {ing.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
