import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { X, ChefHat, Plus } from 'lucide-react';
import { getMacrosForItems } from '../../utils/api.js';

export default function MealCell({
  cellId,
  items = [],
  recipes,
  pantry,
  isPendingTarget,   // true when a recipe has been tapped in the panel (two-tap flow)
  onTap,             // called when the cell or its "+" is clicked
  onRemoveItem,
  onMarkCooked,
}) {
  const { isOver, setNodeRef } = useDroppable({ id: cellId });
  const totals   = getMacrosForItems(items, recipes);
  const hasItems = items.length > 0;

  const cellBase  = 'min-h-[88px] rounded-lg border transition-colors p-1.5 flex flex-col gap-1';
  const cellStyle = isOver
    ? 'border-accent bg-accent/8'
    : isPendingTarget
      ? 'border-accent/40 bg-accent/5 cursor-pointer'
      : hasItems
        ? 'border-border bg-white/2'
        : 'border-dashed border-border/40 bg-transparent';

  return (
    <div
      ref={setNodeRef}
      className={`${cellBase} ${cellStyle}`}
      // Clicking the cell background in pending-target mode places the recipe
      onClick={(e) => {
        if (e.target === e.currentTarget && isPendingTarget) onTap?.();
      }}
    >
      {/* Meal items */}
      {items.map((item, i) => (
        <MealItem
          key={item.id ?? i}
          item={item}
          recipes={recipes}
          onRemove={() => onRemoveItem(item)}
          onMarkCooked={() => onMarkCooked(item)}
        />
      ))}

      {/* Add / tap-target button */}
      <button
        className={`flex items-center justify-center gap-1 text-[10px] py-1 rounded transition-colors mt-auto
          ${isPendingTarget
            ? 'text-accent hover:bg-accent/10 font-medium'
            : 'text-slate-700 hover:text-slate-400 hover:bg-white/5'
          }`}
        onClick={onTap}
      >
        <Plus size={10} />
        {isPendingTarget && <span>Add here</span>}
      </button>

      {/* Per-cell macro strip */}
      {hasItems && (
        <div className="border-t border-border/40 pt-1 text-[9px] flex gap-1.5 text-slate-600 flex-wrap leading-none">
          <span className="text-cals/60">{Math.round(totals.kcal)}</span>
          <span className="text-protein/60">{Math.round(totals.protein)}P</span>
          <span className="text-carbs/60">{Math.round(totals.carbs)}C</span>
          <span className="text-fat/60">{Math.round(totals.fat)}F</span>
        </div>
      )}
    </div>
  );
}

function MealItem({ item, recipes, onRemove, onMarkCooked }) {
  const [hovered, setHovered] = useState(false);

  if (item.type === 'recipe') {
    const recipe = recipes.find(r => r.id === item.recipeId);
    if (!recipe) return null;
    return (
      <div
        className="relative bg-white/5 rounded px-1.5 py-1 text-[11px] flex items-center justify-between gap-1 group"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onTouchStart={() => setHovered(true)}
        onTouchEnd={() => setTimeout(() => setHovered(false), 1500)}
      >
        <span className="text-slate-200 font-medium leading-tight truncate">{recipe.name}</span>
        {hovered && (
          <div className="flex gap-0.5 shrink-0">
            <button
              onClick={onMarkCooked}
              title="Mark cooked & deduct pantry"
              className="text-protein/70 hover:text-protein p-0.5"
            >
              <ChefHat size={10} />
            </button>
            <button onClick={onRemove} className="text-slate-500 hover:text-red-400 p-0.5">
              <X size={10} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // quicklog
  return (
    <div className="relative group bg-cals/5 border border-cals/20 rounded px-1.5 py-1 text-[11px] flex items-center justify-between gap-1">
      <span className="text-slate-300 truncate">{item.name}</span>
      <button
        onClick={onRemove}
        className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 shrink-0 p-0.5"
      >
        <X size={10} />
      </button>
    </div>
  );
}
