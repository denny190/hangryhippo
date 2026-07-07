import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Search, X, Layers } from 'lucide-react';

const MEAL_TYPES = ['all', 'breakfast', 'lunch/dinner', 'snack', 'beverage'];

function DraggableRecipe({ recipe, onTapRecipe }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe-${recipe.id}`,
    data: { recipeId: recipe.id, type: 'recipe' },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ touchAction: 'none', userSelect: 'none' }}
      className={`px-3 py-2.5 rounded-lg border border-border select-none transition-opacity
        cursor-grab active:cursor-grabbing
        ${isDragging ? 'opacity-30' : 'hover:border-accent/40 hover:bg-white/5'}`}
      onClick={() => onTapRecipe?.(recipe)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-200 font-medium truncate">{recipe.name}</span>
        {recipe.portions > 1 && (
          <Layers size={11} className="text-accent shrink-0" title={`${recipe.portions} portions`} />
        )}
      </div>
      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
        <span className="text-cals">{recipe.macros?.kcal ?? 0} kcal</span>
        <span className="text-protein">{recipe.macros?.protein ?? 0}g P</span>
      </div>
    </div>
  );
}

export default function RecipePanel({ recipes, isOpen, onClose, onTapRecipe }) {
  const [search,     setSearch]     = useState('');
  const [mealFilter, setMealFilter] = useState('all');

  const filtered = recipes
    .filter(r => mealFilter === 'all' || r.mealType === mealFilter)
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      {/* Desktop side panel */}
      <div className={`hidden lg:flex flex-col shrink-0 transition-all duration-200 overflow-hidden ${isOpen ? 'w-60' : 'w-0'}`}>
        {isOpen && (
          <div className="card flex flex-col h-full p-3 gap-3 w-60">
            <PanelContent
              search={search} setSearch={setSearch}
              mealFilter={mealFilter} setMealFilter={setMealFilter}
              filtered={filtered} onTapRecipe={onTapRecipe}
              hint="Drag to slots"
            />
          </div>
        )}
      </div>

      {/* Mobile slide-in drawer */}
      <div className={`lg:hidden fixed inset-0 z-40 transition-all duration-300 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
        />
        <div className={`absolute right-0 inset-y-0 w-72 bg-card border-l border-border flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between px-3 py-3 border-b border-border shrink-0">
            <span className="font-semibold text-sm text-slate-200">Recipes</span>
            <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
          </div>
          <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3">
            <PanelContent
              search={search} setSearch={setSearch}
              mealFilter={mealFilter} setMealFilter={setMealFilter}
              filtered={filtered}
              onTapRecipe={(r) => { onClose(); onTapRecipe?.(r); }}
              hint="Tap to select, then tap a slot"
            />
          </div>
        </div>
      </div>
    </>
  );
}

function PanelContent({ search, setSearch, mealFilter, setMealFilter, filtered, onTapRecipe, hint }) {
  return (
    <>
      <div className="relative shrink-0">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-8 text-xs" placeholder="Search recipes…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="flex gap-1 flex-wrap shrink-0">
        {MEAL_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setMealFilter(t)}
            className={`text-xs px-2 py-1 rounded-lg transition-colors ${mealFilter === t ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
          >
            {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto space-y-1.5 overscroll-contain">
        {filtered.length === 0 && <p className="text-xs text-slate-500 text-center py-6">No recipes found</p>}
        {filtered.map(recipe => (
          <DraggableRecipe key={recipe.id} recipe={recipe} onTapRecipe={onTapRecipe} />
        ))}
      </div>
      <p className="text-[10px] text-slate-600 text-center shrink-0">{hint}</p>
    </>
  );
}
