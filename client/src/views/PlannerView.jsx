import React, { useState, useCallback, useMemo } from 'react';
import {
  DndContext, DragOverlay, pointerWithin,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, LayoutGrid, ShoppingCart, ListFilter, X, PenLine, Scan, Search } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import {
  DAYS, MEAL_TYPES, MEAL_LABELS,
  getWeekDates, prevWeek, nextWeek,
  cellId, toLocalDateStr, getISOWeek,
} from '../utils/weekUtils.js';
import { api, getMacrosForItems } from '../utils/api.js';
import MealCell from '../components/planner/MealCell.jsx';
import RecipePanel from '../components/planner/RecipePanel.jsx';
import ShoppingList from '../components/planner/ShoppingList.jsx';
import Modal from '../components/common/Modal.jsx';
import QuickLogModal from '../components/summary/QuickLogModal.jsx';
import BarcodeModal from '../components/recipes/BarcodeModal.jsx';

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ── Constants ──────────────────────────────────────────────────────────────

const SLOT_TAG = {
  breakfast: 'breakfast',
  lunch:     'lunch/dinner',
  dinner:    'lunch/dinner',
  snack:     'snack',
};

const MEAL_TAG_COLORS = {
  breakfast:      'bg-yellow-500/15 text-yellow-300',
  'lunch/dinner': 'bg-blue-500/15 text-blue-300',
  snack:          'bg-green-500/15 text-green-300',
  beverage:       'bg-cyan-500/15 text-cyan-300',
  lunch:          'bg-blue-500/15 text-blue-300',
  dinner:         'bg-blue-500/15 text-blue-300',
};

// ── RecipePickerModal ──────────────────────────────────────────────────────

function RecipePickerModal({ mealType, recipes, onSelect, onAddItem, onClose, onCustom }) {
  const { state: { foods }, dispatch } = useApp();

  const [activeTab,    setActiveTab]    = useState('recipes');
  const [search,       setSearch]       = useState('');
  const [foodSearch,   setFoodSearch]   = useState('');
  const [selectedFood, setSelectedFood] = useState(null);
  // selectedFood: { food, qty, isNew } | null
  const [showScanner,  setShowScanner]  = useState(false);
  const [savingFood,   setSavingFood]   = useState(false);

  // Recipes tab
  const suggestedTag = SLOT_TAG[mealType] ?? null;
  const q = search.toLowerCase();
  const visible   = recipes.filter(r => !q || r.name.toLowerCase().includes(q));
  const suggested = !q && suggestedTag ? visible.filter(r => r.mealType === suggestedTag) : [];
  const others    = !q && suggestedTag ? visible.filter(r => r.mealType !== suggestedTag) : visible;

  // Foods tab
  const fq           = foodSearch.toLowerCase();
  const visibleFoods = foods.filter(f => !fq || f.name.toLowerCase().includes(fq));

  // Macro preview for selected food at given qty
  const scaledMacros = useMemo(() => {
    if (!selectedFood) return null;
    const { food, qty } = selectedFood;
    const scale = (parseFloat(qty) || 0) / (parseFloat(food.per) || 100);
    return {
      kcal:    Math.round((food.kcal    || 0) * scale),
      protein: Math.round((food.protein || 0) * scale * 10) / 10,
      carbs:   Math.round((food.carbs   || 0) * scale * 10) / 10,
      fat:     Math.round((food.fat     || 0) * scale * 10) / 10,
    };
  }, [selectedFood]);

  const handleAddExistingFood = () => {
    if (!selectedFood) return;
    onAddItem({
      type:     'food',
      id:       genId(),
      foodId:   selectedFood.food.id,
      quantity: parseFloat(selectedFood.qty) || selectedFood.food.per,
      unit:     selectedFood.food.unit,
    });
    onClose();
  };

  const handleQuickAddNew = () => {
    if (!selectedFood || !scaledMacros) return;
    onAddItem({ type: 'quicklog', id: genId(), name: selectedFood.food.name, ...scaledMacros });
    onClose();
  };

  const handleSaveAndAdd = async () => {
    if (!selectedFood) return;
    setSavingFood(true);
    try {
      const saved = await api.createFood(selectedFood.food);
      dispatch({ type: 'ADD_FOOD', payload: saved });
      onAddItem({
        type:     'food',
        id:       genId(),
        foodId:   saved.id,
        quantity: parseFloat(selectedFood.qty) || selectedFood.food.per,
        unit:     saved.unit,
      });
      onClose();
    } catch {
      setSavingFood(false);
    }
  };

  const RecipeBtn = ({ r }) => (
    <button
      onClick={() => { onSelect(r); onClose(); }}
      className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:border-accent/40 hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-200 flex-1 truncate">{r.name}</span>
        {r.mealType && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${MEAL_TAG_COLORS[r.mealType] ?? 'bg-white/10 text-slate-400'}`}>
            {r.mealType}
          </span>
        )}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{r.macros?.kcal ?? 0} kcal · {r.macros?.protein ?? 0}g P</div>
    </button>
  );

  return (
    <Modal title={`Add to ${MEAL_LABELS[mealType] || 'Meal'}`} onClose={onClose} size="sm">
      <div className="space-y-3">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
          {[['recipes', 'Recipes'], ['foods', 'Foods']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setSelectedFood(null); }}
              className={`flex-1 py-1.5 text-sm rounded-lg transition-colors
                ${activeTab === id ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Recipes tab ── */}
        {activeTab === 'recipes' && (
          <>
            <input
              className="input"
              placeholder="Search recipes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {suggested.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-0.5">Suggested</p>
                  {suggested.map(r => <RecipeBtn key={r.id} r={r} />)}
                  {others.length > 0 && (
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-0.5 pt-1">All recipes</p>
                  )}
                </>
              )}
              {others.map(r => <RecipeBtn key={r.id} r={r} />)}
              {visible.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No recipes found</p>}
            </div>
            <div className="pt-3 border-t border-border/40">
              <button
                onClick={onCustom}
                className="w-full btn-ghost justify-center gap-2 text-slate-400 hover:text-slate-200 text-sm"
              >
                <PenLine size={13} /> Add custom macros
              </button>
            </div>
          </>
        )}

        {/* ── Foods tab ── */}
        {activeTab === 'foods' && (
          <>
            {selectedFood ? (
              /* Quantity confirmation panel */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-200 truncate flex-1 mr-2">{selectedFood.food.name}</p>
                  <button onClick={() => setSelectedFood(null)} className="text-xs text-slate-500 hover:text-slate-300 shrink-0">
                    ← Back
                  </button>
                </div>
                <p className="text-xs text-slate-500">per {selectedFood.food.per}{selectedFood.food.unit} · adjust quantity</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    className="input w-28 tabular-nums"
                    value={selectedFood.qty}
                    onChange={e => setSelectedFood(sf => ({ ...sf, qty: e.target.value }))}
                    autoFocus
                  />
                  <span className="text-sm text-slate-400">{selectedFood.food.unit}</span>
                </div>
                {scaledMacros && (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[['kcal', scaledMacros.kcal, 'text-cals'], ['P', scaledMacros.protein, 'text-protein'], ['C', scaledMacros.carbs, 'text-carbs'], ['F', scaledMacros.fat, 'text-fat']].map(([label, val, color]) => (
                      <div key={label} className="bg-white/3 rounded-lg py-1.5">
                        <div className={`text-sm font-semibold ${color} tabular-nums`}>{val}</div>
                        <div className="text-[10px] text-slate-500">{label}</div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedFood.isNew ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleSaveAndAdd}
                      disabled={savingFood}
                      className="btn-primary w-full justify-center"
                    >
                      {savingFood ? 'Saving…' : 'Save to Foods & add'}
                    </button>
                    <button onClick={handleQuickAddNew} className="btn-ghost w-full justify-center text-sm text-slate-400">
                      Quick add (one-time)
                    </button>
                  </div>
                ) : (
                  <button onClick={handleAddExistingFood} className="btn-primary w-full justify-center">
                    Add to slot
                  </button>
                )}
              </div>
            ) : (
              /* Foods list */
              <>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input pl-8 text-sm"
                      placeholder="Search foods…"
                      value={foodSearch}
                      onChange={e => setFoodSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <button
                    className="btn-ghost border border-border shrink-0"
                    onClick={() => setShowScanner(true)}
                    title="Scan barcode"
                  >
                    <Scan size={14} />
                  </button>
                </div>

                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {visibleFoods.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-6">
                      {foods.length === 0
                        ? 'No foods yet — add some in the Foods tab first'
                        : 'No results'}
                    </p>
                  ) : (
                    visibleFoods.map(food => (
                      <button
                        key={food.id}
                        onClick={() => setSelectedFood({ food, qty: String(food.per), isNew: false })}
                        className="w-full text-left px-3 py-2 rounded-lg border border-border hover:border-accent/40 hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200 flex-1 truncate">{food.name}</span>
                          <span className="text-xs text-slate-500 shrink-0">per {food.per}{food.unit}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span className="text-cals/70">{food.kcal} kcal</span>
                          <span className="mx-1 text-slate-600">·</span>
                          <span className="text-protein/70">{food.protein}g P</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="pt-3 border-t border-border/40">
                  <button
                    onClick={onCustom}
                    className="w-full btn-ghost justify-center gap-2 text-slate-400 hover:text-slate-200 text-sm"
                  >
                    <PenLine size={13} /> Add custom macros
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {showScanner && (
        <BarcodeModal
          foods={foods}
          onFound={(data) => {
            setShowScanner(false);
            setSelectedFood({ food: data, qty: String(data.per || 100), isNew: true });
          }}
          onFoundExisting={(food) => {
            setShowScanner(false);
            setSelectedFood({ food, qty: String(food.per), isNew: false });
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </Modal>
  );
}

// ── BatchFillModal ─────────────────────────────────────────────────────────

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
        <input className="input w-20" type="number" min="0" max={maxFill} value={count} onChange={e => setCount(Number(e.target.value))} />
        <span className="text-sm text-slate-400">day(s)</span>
      </div>
      <div className="flex gap-3">
        <button className="btn-ghost flex-1 justify-center" onClick={onClose}>Skip</button>
        <button className="btn-primary flex-1 justify-center" onClick={() => { onConfirm(count); onClose(); }}>Auto-fill</button>
      </div>
    </Modal>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────

export default function PlannerView() {
  const { state, dispatch, updateCell, saveMealPlan } = useApp();
  const { recipes, foods, mealPlan, currentWeek } = state;

  const [panelOpen,     setPanelOpen]     = useState(false);
  const [showShopping,  setShowShopping]  = useState(false);
  const [pickerCell,    setPickerCell]    = useState(null);
  const [quickCell,     setQuickCell]     = useState(null);
  const [batchModal,    setBatchModal]    = useState(null);
  const [activeRecipe,  setActiveRecipe]  = useState(null);
  const [pendingRecipe, setPendingRecipe] = useState(null);

  const weekDates = getWeekDates(currentWeek);
  const todayStr  = toLocalDateStr(new Date());
  const todayWeek = getISOWeek();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const goWeekNav = (dir) => {
    const w = dir < 0 ? prevWeek(currentWeek) : nextWeek(currentWeek);
    dispatch({ type: 'SET_WEEK', payload: w });
  };

  const addRecipeToCell = useCallback((cId, recipe, basePlan = null) => {
    const plan    = basePlan ?? mealPlan;
    const newItem = { type: 'recipe', id: genId(), recipeId: recipe.id };
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

  // DnD
  const handleDragStart = ({ active }) => {
    const recipe = recipes.find(r => r.id === active.data.current?.recipeId);
    setActiveRecipe(recipe ?? null);
    setPendingRecipe(null);
  };

  const handleDragEnd = useCallback(({ active, over }) => {
    setActiveRecipe(null);
    if (!over || !active.data.current?.recipeId) return;
    const recipe = recipes.find(r => r.id === active.data.current.recipeId);
    if (recipe) addRecipeToCell(over.id, recipe);
  }, [recipes, addRecipeToCell]);

  // Batch fill
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

  // Two-tap mobile flow
  const handleTapRecipe = (recipe) => {
    setPanelOpen(false);
    setPendingRecipe(recipe);
  };

  const handleCellTap = (cId, mealType) => {
    if (pendingRecipe) {
      addRecipeToCell(cId, pendingRecipe);
      setPendingRecipe(null);
    } else {
      setPickerCell({ cId, mealType });
    }
  };

  const getDayTotal = (dayIdx) =>
    MEAL_TYPES.reduce((acc, meal) =>
      acc + getMacrosForItems(mealPlan[cellId(dayIdx, meal)] || [], recipes, foods).kcal, 0);

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
        <RecipePanel
          recipes={recipes}
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          onTapRecipe={handleTapRecipe}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveRecipe(null)}
        >
          <div className="flex-1 overflow-x-auto overflow-y-auto p-3 lg:p-4">
            <div className="min-w-[640px]">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {DAYS.map((day, i) => {
                  const date    = weekDates[i];
                  const isToday = toLocalDateStr(date) === todayStr;
                  const dayKcal = getDayTotal(i);
                  return (
                    <div key={day} className={`text-center px-1 py-1.5 rounded-lg ${isToday ? 'bg-accent/10 border border-accent/20' : ''}`}>
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
                          foods={foods}
                          isPendingTarget={!!pendingRecipe}
                          onTap={() => handleCellTap(cId, meal)}
                          onRemoveItem={(item) => updateCell(cId, items.filter(i => i.id !== item.id))}
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

      {/* Pending recipe banner */}
      {pendingRecipe && (
        <div className="fixed bottom-16 lg:bottom-4 inset-x-3 z-50 flex items-center gap-3 bg-accent shadow-2xl rounded-xl px-4 py-3">
          <span className="flex-1 text-sm text-white font-medium truncate">
            Tap a slot → "{pendingRecipe.name}"
          </span>
          <button onClick={() => setPendingRecipe(null)} className="text-white/70 hover:text-white shrink-0">
            <X size={18} />
          </button>
        </div>
      )}

      {pickerCell && (
        <RecipePickerModal
          mealType={pickerCell.mealType}
          recipes={recipes}
          onSelect={(recipe) => { addRecipeToCell(pickerCell.cId, recipe); setPickerCell(null); }}
          onAddItem={(item) => { updateCell(pickerCell.cId, [...(mealPlan[pickerCell.cId] || []), item]); setPickerCell(null); }}
          onCustom={() => { setQuickCell(pickerCell); setPickerCell(null); }}
          onClose={() => setPickerCell(null)}
        />
      )}
      {quickCell && (
        <QuickLogModal
          title="Custom Entry"
          submitLabel="Add to slot"
          onAdd={(item) => { updateCell(quickCell.cId, [...(mealPlan[quickCell.cId] || []), item]); setQuickCell(null); }}
          onClose={() => setQuickCell(null)}
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
      {showShopping && (
        <ShoppingList
          onClose={() => setShowShopping(false)}
          mealPlan={mealPlan}
          recipes={recipes}
        />
      )}
    </div>
  );
}
