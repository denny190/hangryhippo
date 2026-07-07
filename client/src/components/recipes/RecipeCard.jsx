import React from 'react';
import { Edit2, Trash2, Layers } from 'lucide-react';

const MEAL_COLORS = {
  breakfast:      'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  'lunch/dinner': 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  snack:          'bg-green-500/15 text-green-300 border-green-500/20',
  beverage:       'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  // backward compat for old saved recipes
  lunch:          'bg-blue-500/15 text-blue-300 border-blue-500/20',
  dinner:         'bg-blue-500/15 text-blue-300 border-blue-500/20',
};

export default function RecipeCard({ recipe, onEdit, onDelete }) {
  return (
    <div className="card p-4 flex flex-col gap-3">
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
      {recipe.portions > 1 && (
        <p className="text-[10px] text-slate-600 text-center -mt-1">
          per portion · {Math.round((recipe.macros?.kcal ?? 0) * recipe.portions)} kcal total batch
        </p>
      )}

      {recipe.prepNotes && (
        <p className="text-xs text-slate-500 leading-relaxed">{recipe.prepNotes}</p>
      )}
    </div>
  );
}
