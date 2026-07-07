import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { X, Plus } from 'lucide-react';
import { getMacrosForItems } from '../../utils/api.js';

export default function MealCell({
  cellId,
  items = [],
  recipes,
  foods = [],
  isPendingTarget,
  onTap,
  onRemoveItem,
}) {
  const { isOver, setNodeRef } = useDroppable({ id: cellId });
  const totals   = getMacrosForItems(items, recipes, foods);
  const hasItems = items.length > 0;

  const borderStyle = isOver
    ? 'border-accent bg-accent/8'
    : isPendingTarget
      ? 'border-accent/40 bg-accent/5 cursor-pointer'
      : hasItems
        ? 'border-border bg-white/2'
        : 'border-dashed border-border/40';

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[88px] rounded-lg border transition-colors p-1.5 flex flex-col gap-1 ${borderStyle}`}
      onClick={(e) => { if (e.target === e.currentTarget && isPendingTarget) onTap?.(); }}
    >
      {items.map((item, i) => (
        <MealItem key={item.id ?? i} item={item} recipes={recipes} foods={foods} onRemove={() => onRemoveItem(item)} />
      ))}

      <button
        className={`flex items-center justify-center gap-1 text-[10px] py-1 rounded transition-colors mt-auto
          ${isPendingTarget ? 'text-accent hover:bg-accent/10 font-medium' : 'text-slate-700 hover:text-slate-400 hover:bg-white/5'}`}
        onClick={onTap}
      >
        <Plus size={10} />
        {isPendingTarget && <span>Add here</span>}
      </button>

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

function MealItem({ item, recipes, foods, onRemove }) {
  const [hovered, setHovered] = useState(false);

  const hoverProps = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onTouchStart: () => setHovered(true),
    onTouchEnd:   () => setTimeout(() => setHovered(false), 1500),
  };

  const RemoveBtn = () => hovered ? (
    <button onClick={onRemove} className="text-slate-500 hover:text-red-400 shrink-0 p-0.5">
      <X size={10} />
    </button>
  ) : null;

  if (item.type === 'recipe') {
    const recipe = recipes.find(r => r.id === item.recipeId);
    if (!recipe) return null;
    return (
      <div
        className="relative bg-white/5 rounded px-1.5 py-1 text-[11px] flex items-center justify-between gap-1"
        {...hoverProps}
      >
        <span className="text-slate-200 font-medium leading-tight truncate">{recipe.name}</span>
        <RemoveBtn />
      </div>
    );
  }

  if (item.type === 'food') {
    const food = foods.find(f => f.id === item.foodId);
    return (
      <div
        className="relative bg-protein/8 border border-dashed border-protein/30 rounded px-1.5 py-1 text-[11px] flex items-center justify-between gap-1"
        {...hoverProps}
      >
        <div className="flex-1 min-w-0">
          <div className="text-slate-300 font-medium truncate">{food?.name ?? 'Unknown food'}</div>
          <div className="text-[10px] text-slate-500">{item.quantity}{item.unit}</div>
        </div>
        <RemoveBtn />
      </div>
    );
  }

  // quicklog
  return (
    <div
      className="relative bg-cals/8 border border-dashed border-cals/30 rounded px-1.5 py-1 text-[11px] flex items-center justify-between gap-1"
      {...hoverProps}
    >
      <div className="flex-1 min-w-0">
        <div className="text-slate-300 font-medium truncate">{item.name || 'Custom entry'}</div>
        <div className="text-[10px] text-cals/60">{item.kcal ?? 0} kcal</div>
      </div>
      <RemoveBtn />
    </div>
  );
}
