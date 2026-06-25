import React, { useState, useCallback } from 'react';
import {
  DndContext, DragOverlay, pointerWithin,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, LayoutGrid, ShoppingCart, ListFilter, X } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import {
  DAYS, MEAL_TYPES, MEAL_LABELS,
  getWeekDates, prevWeek, nextWeek,
  cellId, toLocalDateStr, getISOWeek,
} from '../utils/weekUtils.js';
import { getMacrosForItems } from '../utils/api.js';
import MealCell from '../components/planner/MealCell.jsx';
import RecipePanel from '../components/planner/RecipePanel.jsx';
import ShoppingList from '../components/planner/ShoppingList.jsx';
import Modal from '../components/common/Modal.jsx';

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ── Modals ─────────────────────────────────────────────────────────────────

function RecipePickerModal({ mealType, recipes, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const filtered = recipes
    .filter(r => mealType === 'any' || r.mealType === mealType)
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal title={`Add to ${MEAL_LABELS[mealType] || 'Meal'}`} onClose={onClose} size="sm">
      <div className="space-y-3">
        <input
          className="input"
          placeholder="Search recipes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {filtered.map(r => (
            <button
              key={r.id}
              onClick={() => { onSelect(r); onClose(); }}
              className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:border-accent/40 hover:bg-white/5 transition-colors"
            >
              <div className="text-sm font-medium text-slate-200">{r.name}</div>
              <div className="text-xs text-slate-500">{r.macros?.kcal ?? 0} kcal · {r.macros?.protein ?? 0}g P</div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No recipes found</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function BatchFillModal({ recipe, dayIndex, mealType, onConfirm, onClose }) {
  const maxFill = Math.min(7 - dayIndex - 1, (recipe.portions || 1) - 1);
  const [count, setCount] = useState(maxFill);

  return (
    <Modal title="Auto-fill portions?" onClose={onClose} size="sm">
      <p className="text-sm text-slate-400 mb-4">
        <span className="text-slate-200 font-medium">{recipe.name}</span> yields{' '}
        <span className="text-accent font-medium">{recipe.portions} portions</span>. Fill the next {maxFill} day(s)?
      </p>
      <div className="flex items-center gap-3 mb-5">
        <label className="label mb-0 shrink-0">Fill next</label>
        <input
          className="input w-20"
          type="number" min="0" max={maxFill}
          value={count}
          onChange={e => setCount(Number(e.target.value))}
        />
        <span className="text-sm text-slate-400">day(s)</span>
      </div>
      <div className="flex gap-3">
        <button className="btn-ghost flex-1 justify-center" onClick={onClose}>Skip</button>
        <button className="btn-primary flex-1 justify-center" onClick={() => { onConfirm(count); onClose(); }}>Auto-fill</button>
      </div>
    </Modal>
  );
}

function CookedModal({ recipe, onConfirm, onClose }) {
  return (
    <Modal title="Mark as cooked" onClose={onClose} size="sm">
      <p className="text-sm text-slate-400 mb-5">
        Deduct <span className="text-slate-200 font-medium">{recipe?.name}</span> ingredients from pantry?
      </p>
      <div className="flex gap-3">
        <button className="btn-ghost flex-1 justify-center" onClick={onClose}>Skip</button>
        <button className="btn-primary flex-1 justify-center" onClick={() => { onConfirm(); onClose(); }}>Deduct pantry</button>
      </div>
    </Modal>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────

export default function PlannerView() {
  const { state, dispatch, updateCell, saveMealPlan, deductIngredients } = useApp();
  const { recipes, pantry, mealPlan, currentWeek } = state;

  const [panelOpen,    setPanelOpen]    = useState(false);
  const [showShopping, setShowShopping] = useState(false);
  const [pickerCell,   setPickerCell]   = useState(null);   // { cId, mealType }
  const [batchModal,   setBatchModal]   = useState(null);
  const [cookedModal,  setCookedModal]  = useState(null);
  const [activeRecipe, setActiveRecipe] = useState(null);
  // Two-tap mobile flow: recipe selected in panel, awaiting cell tap
  const [pendingRecipe, setPendingRecipe] = useState(null);

  const weekDates = getWeekDates(currentWeek);
  const todayStr  = toLocalDateStr(new Date());
  const todayWeek = getISOWeek();

  // ── Sensors ─────────────────────────────────────────────────────────────
  // PointerSensor handles mouse + touch + stylus uniformly.
  // distance:8 means the pointer must move 8px before a drag starts,
  // which lets short taps and vertical scroll pass through naturally.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // ── Week navigation ──────────────────────────────────────────────────────
  const goWeekNav = (dir) => {
    const w = dir < 0 ? prevWeek(currentWeek) : nextWeek(currentWeek);
    dispatch({ type: 'SET_WEEK', payload: w });
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const addRecipeToCell = useCallback((cId, recipe, basePlan = null) => {
    const plan   = basePlan ?? mealPlan;
    const newItem  = { type: 'recipe', id: genId(), recipeId: recipe.id };
    const newItems = [...(plan[cId] || []), newItem];
    const newPlan  = { ...plan, [cId]: newItems };

    const [dayStr, mType] = cId.split('_');
    const dayIndex = parseInt(dayStr, 10);

    if (recipe.portions > 1 && dayIndex < 6) {
      saveMealPlan(newPlan);
      setBatchModal({ recipe, dayIndex, mealType: mType, basePlan: newPlan });
    } else {
      updateCell(cId, newItems);
    }
  }, [mealPlan, updateCell, saveMealPlan]);

  // ── DnD handlers ─────────────────────────────────────────────────────────
  const handleDragStart = ({ active }) => {
    const recipe = recipes.find(r => r.id === active.data.current?.recipeId);
    setActiveRecipe(recipe ?? null);
    // Cancel any pending tap-select when the user starts dragging
    setPendingRecipe(null);
  };

  const handleDragEnd = useCallback(({ active, over }) => {
    setActiveRecipe(null);
    if (!over || !active.data.current?.recipeId) return;
    const recipe = recipes.find(r => r.id === active.data.current.recipeId);
    if (!recipe) return;
    addRecipeToCell(over.id, recipe);
  }, [recipes, addRecipeToCell]);

  const handleDragCancel = () => setActiveRecipe(null);

  // ── Batch fill ───────────────────────────────────────────────────────────
  const handleBatchFill = (count) => {
    if (!batchModal) return;
    const { recipe, dayIndex, mealType, basePlan } = batchModal;
    const plan = { ...basePlan };
    for (let i = 1; i <= count; i++) {
      const d = dayIndex + i;
      if (d > 6) break;
      const cId = cellId(d, mealType);
      plan[cId] = [...(plan[cId] || []), { type: 'recipe', id: genId(), recipeId: recipe.id }];
    }
    saveMealPlan(plan);
    setBatchModal(null);
  };

  // ── Mobile two-tap flow ──────────────────────────────────────────────────
  // Called when user taps a recipe in the mobile panel drawer
  const handleTapRecipe = (recipe) => {
    setPanelOpen(false);
    setPendingRecipe(recipe);
  };

  // Called when a cell is tapped (either to open picker or to place pendingRecipe)
  const handleCellTap = (cId, mealType) => {
    if (pendingRecipe) {
      addRecipeToCell(cId, pendingRecipe);
      setPendingRecipe(null);
    } else {
      setPickerCell({ cId, mealType });
    }
  };

  // Picker modal select
  const handlePickerSelect = (recipe) => {
    if (!pickerCell) return;
    addRecipeToCell(pickerCell.cId, recipe);
    setPickerCell(null);
  };

  // Remove item
  const handleRemoveItem = (cId, item) => {
    updateCell(cId, (mealPlan[cId] || []).filter(i => i.id !== item.id));
  };

  // Mark cooked
  const handleMarkCooked = (cId, item) => {
    if (item.type !== 'recipe') return;
    const recipe = recipes.find(r => r.id === item.recipeId);
    setCookedModal({ recipe, cellId: cId });
  };

  const confirmCooked = () => {
    if (cookedModal?.recipe?.ingredients) deductIngredients(cookedModal.recipe.ingredients);
  };

  // Day kcal
  const getDayTotal = (dayIdx) =>
    MEAL_TYPES.reduce((acc, meal) =>
      acc + getMacrosForItems(mealPlan[cellId(dayIdx, meal)] || [], recipes).kcal, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-border shrink-0">
        <button onClick={() => goWeekNav(-1)} className="btn-ghost p-1.5"><ChevronLeft size={16} /></button>
        <div className="flex-1 text-center">
          <span className="text-sm font-semibold text-slate-200">{currentWeek}</span>
          {currentWeek === todayWeek && (
            <span className="ml-2 badge bg-accent/15 text-accent border border-accent/20 text-[10px]">this week</span>
          )}
        </div>
        <button onClick={() => goWeekNav(1)} className="btn-ghost p-1.5"><ChevronRight size={16} /></button>
        <button
          onClick={() => setPanelOpen(o => !o)}
          className={`btn-ghost p-1.5 ml-1 ${panelOpen ? 'text-accent' : ''}`}
          title="Recipe panel"
        >
          <LayoutGrid size={16} />
        </button>
        <button onClick={() => setShowShopping(true)} className="btn-ghost p-1.5" title="Shopping list">
          <ShoppingCart size={16} />
        </button>
        <button
          onClick={() => saveMealPlan({})}
          className="btn-ghost p-1.5 text-red-400/60 hover:text-red-400"
          title="Clear week"
        >
          <ListFilter size={16} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Recipe panel */}
        <RecipePanel
          recipes={recipes}
          pantry={pantry}
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          onTapRecipe={handleTapRecipe}
        />

        {/* Week grid */}
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex-1 overflow-x-auto overflow-y-auto p-3 lg:p-4">
            <div className="min-w-[640px]">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {DAYS.map((day, i) => {
                  const date    = weekDates[i];
                  const dateStr = toLocalDateStr(date);
                  const isToday = dateStr === todayStr;
                  const dayKcal = getDayTotal(i);
                  return (
                    <div
                      key={day}
                      className={`text-center px-1 py-1.5 rounded-lg ${isToday ? 'bg-accent/10 border border-accent/20' : ''}`}
                    >
                      <div className={`text-xs font-semibold ${isToday ? 'text-accent' : 'text-slate-400'}`}>{day}</div>
                      <div className={`text-[10px] ${isToday ? 'text-accent/60' : 'text-slate-600'}`}>
                        {date.getUTCDate()}/{date.getUTCMonth() + 1}
                      </div>
                      {dayKcal > 0 && (
                        <div className="text-[10px] text-cals/50 mt-0.5">{Math.round(dayKcal)}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Meal rows */}
              {MEAL_TYPES.map(meal => (
                <div key={meal} className="mb-2.5">
                  <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1 pl-0.5">
                    {MEAL_LABELS[meal]}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAYS.map((_, dayIdx) => {
                      const cId   = cellId(dayIdx, meal);
                      const items = mealPlan[cId] || [];
                      return (
                        <MealCell
                          key={cId}
                          cellId={cId}
                          items={items}
                          recipes={recipes}
                          pantry={pantry}
                          isPendingTarget={!!pendingRecipe}
                          onTap={() => handleCellTap(cId, meal)}
                          onRemoveItem={(item) => handleRemoveItem(cId, item)}
                          onMarkCooked={(item) => handleMarkCooked(cId, item)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeRecipe && (
              <div className="bg-card border border-accent/50 rounded-lg px-3 py-2 shadow-2xl text-sm font-medium text-white opacity-95 pointer-events-none">
                {activeRecipe.name}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Pending recipe banner (mobile two-tap flow) */}
      {pendingRecipe && (
        <div className="fixed bottom-16 lg:bottom-4 inset-x-3 z-50 flex items-center gap-3 bg-accent shadow-2xl rounded-xl px-4 py-3 pointer-events-auto">
          <span className="flex-1 text-sm text-white font-medium truncate">
            Tap a slot → "{pendingRecipe.name}"
          </span>
          <button
            onClick={() => setPendingRecipe(null)}
            className="text-white/70 hover:text-white shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Modals */}
      {pickerCell && (
        <RecipePickerModal
          mealType={pickerCell.mealType}
          recipes={recipes}
          onSelect={handlePickerSelect}
          onClose={() => setPickerCell(null)}
        />
      )}
      {batchModal && (
        <BatchFillModal
          recipe={batchModal.recipe}
          dayIndex={batchModal.dayIndex}
          mealType={batchModal.mealType}
          onConfirm={handleBatchFill}
          onClose={() => setBatchModal(null)}
        />
      )}
      {cookedModal && (
        <CookedModal
          recipe={cookedModal.recipe}
          onConfirm={confirmCooked}
          onClose={() => setCookedModal(null)}
        />
      )}
      {showShopping && (
        <ShoppingList
          onClose={() => setShowShopping(false)}
          mealPlan={mealPlan}
          recipes={recipes}
          pantry={pantry}
        />
      )}
    </div>
  );
}
