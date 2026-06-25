import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, Zap } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import { calcRecipeMacros, scaleFoodMacros } from '../../utils/api.js';
import { useApp } from '../../context/AppContext.jsx';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

function emptyRecipe() {
  return {
    name: '',
    mealType: 'lunch',
    ingredients: [],
    macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    prepNotes: '',
    portions: 1,
  };
}

function emptyIngredient() {
  return { name: '', quantity: '', unit: 'g', foodId: null };
}

// Dropdown autocomplete for picking a food from the DB
function FoodPicker({ value, onChange, onSelect, foods }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const matches = useMemo(() => {
    if (!value.trim()) return foods.slice(0, 8);
    const q = value.toLowerCase();
    return foods.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [value, foods]);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative flex-1">
      <input
        className="input text-sm py-1.5 w-full"
        placeholder="Ingredient name"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          {matches.map(food => (
            <button
              key={food.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center justify-between"
              onMouseDown={() => { onSelect(food); setOpen(false); }}
            >
              <span className="text-slate-200">{food.name}</span>
              <span className="text-xs text-slate-500">{food.kcal} kcal / {food.per}{food.unit}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RecipeForm({ initial, onClose, onSave }) {
  const { state: { foods } } = useApp();

  const [form, setForm] = useState(() => initial ? {
    ...initial,
    macros: { ...initial.macros },
    ingredients: initial.ingredients?.map(i => ({ ...i })) ?? [],
  } : emptyRecipe());

  const [macroOverride, setMacroOverride] = useState(false);

  // Auto-calculate macros whenever ingredients change
  const autoMacros = useMemo(() => {
    const m = calcRecipeMacros(form.ingredients, foods);
    return {
      kcal:    Math.round(m.kcal),
      protein: Math.round(m.protein * 10) / 10,
      carbs:   Math.round(m.carbs   * 10) / 10,
      fat:     Math.round(m.fat     * 10) / 10,
    };
  }, [form.ingredients, foods]);

  const hasLinkedIngredients = form.ingredients.some(i => i.foodId);
  // Use auto macros unless the user explicitly overrides
  const displayMacros = (hasLinkedIngredients && !macroOverride) ? autoMacros : form.macros;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setMacro = (k, v) => setForm(f => ({ ...f, macros: { ...f.macros, [k]: v } }));

  const addIngredient = () => setForm(f => ({ ...f, ingredients: [...f.ingredients, emptyIngredient()] }));
  const removeIngredient = (i) => setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) }));

  const setIngredient = (i, patch) => setForm(f => ({
    ...f,
    ingredients: f.ingredients.map((ing, idx) => idx === i ? { ...ing, ...patch } : ing),
  }));

  const handleFoodSelect = (i, food) => {
    setIngredient(i, {
      name: food.name,
      foodId: food.id,
      unit: food.unit,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const macros = (hasLinkedIngredients && !macroOverride) ? autoMacros : {
      kcal:    parseFloat(form.macros.kcal)    || 0,
      protein: parseFloat(form.macros.protein) || 0,
      carbs:   parseFloat(form.macros.carbs)   || 0,
      fat:     parseFloat(form.macros.fat)     || 0,
    };
    onSave({ ...form, macros, portions: parseInt(form.portions) || 1 });
    onClose();
  };

  return (
    <Modal title={initial ? 'Edit Recipe' : 'New Recipe'} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Recipe name *</label>
            <input className="input" required placeholder="e.g. High-protein overnight oats" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="label">Meal type</label>
            <select className="input" value={form.mealType} onChange={e => set('mealType', e.target.value)}>
              {MEAL_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Portions made</label>
            <input className="input" type="number" min="1" value={form.portions} onChange={e => set('portions', e.target.value)} />
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="label mb-0">Ingredients</p>
            <button type="button" className="btn-ghost text-xs gap-1" onClick={addIngredient}>
              <Plus size={13} /> Add ingredient
            </button>
          </div>
          <div className="space-y-2">
            {form.ingredients.map((ing, i) => (
              <IngredientRow
                key={i}
                ing={ing}
                foods={foods}
                onChange={(patch) => setIngredient(i, patch)}
                onFoodSelect={(food) => handleFoodSelect(i, food)}
                onRemove={() => removeIngredient(i)}
              />
            ))}
            {form.ingredients.length === 0 && (
              <p className="text-xs text-slate-500 py-2">
                No ingredients yet. Add them to enable auto macro calculation.
              </p>
            )}
          </div>
        </div>

        {/* Macros */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="label mb-0">Macros per serving</p>
            {hasLinkedIngredients && (
              <button
                type="button"
                className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${macroOverride ? 'text-slate-400 hover:text-slate-200' : 'text-accent'}`}
                onClick={() => setMacroOverride(o => !o)}
              >
                <Zap size={11} />
                {macroOverride ? 'Use auto-calc' : 'Auto-calculated'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { k: 'kcal',    label: 'Calories', color: 'text-cals' },
              { k: 'protein', label: 'Protein g', color: 'text-protein' },
              { k: 'carbs',   label: 'Carbs g',   color: 'text-carbs' },
              { k: 'fat',     label: 'Fat g',      color: 'text-fat' },
            ].map(({ k, label, color }) => (
              <div key={k}>
                <label className={`label ${color}`}>{label}</label>
                {hasLinkedIngredients && !macroOverride ? (
                  <div className={`input text-center font-semibold ${color} cursor-default`}>
                    {autoMacros[k]}
                  </div>
                ) : (
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.macros[k]}
                    onChange={e => setMacro(k, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          {hasLinkedIngredients && !macroOverride && (
            <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
              <Zap size={9} className="text-accent" />
              Calculated from linked ingredients · click to override manually
            </p>
          )}
        </div>

        {/* Prep notes */}
        <div>
          <label className="label">Prep notes</label>
          <textarea className="input min-h-[72px] resize-none" placeholder="Optional instructions or tips…" value={form.prepNotes} onChange={e => set('prepNotes', e.target.value)} />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" className="btn-ghost flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary flex-1 justify-center">{initial ? 'Save changes' : 'Add recipe'}</button>
        </div>
      </form>
    </Modal>
  );
}

function IngredientRow({ ing, foods, onChange, onFoodSelect, onRemove }) {
  const linkedFood = foods.find(f => f.id === ing.foodId);
  const contribution = linkedFood ? scaleFoodMacros(linkedFood, ing.quantity) : null;

  return (
    <div className="space-y-1">
      <div className="flex gap-2 items-center">
        <FoodPicker
          value={ing.name}
          onChange={(v) => onChange({ name: v, foodId: null })}
          onSelect={onFoodSelect}
          foods={foods}
        />
        <input
          className="input w-20 shrink-0 text-sm py-1.5"
          placeholder="Qty"
          value={ing.quantity}
          onChange={e => onChange({ quantity: e.target.value })}
        />
        <span className="text-xs text-slate-500 w-8 shrink-0">{ing.unit || 'g'}</span>
        <button type="button" className="btn-danger p-1.5 shrink-0" onClick={onRemove}>
          <Trash2 size={14} />
        </button>
      </div>
      {contribution && ing.quantity && (
        <div className="flex gap-3 pl-1 text-[10px] text-slate-500">
          <span className="text-cals/70">{Math.round(contribution.kcal)} kcal</span>
          <span className="text-protein/70">{Math.round(contribution.protein * 10) / 10}g P</span>
          <span className="text-carbs/70">{Math.round(contribution.carbs * 10) / 10}g C</span>
          <span className="text-fat/70">{Math.round(contribution.fat * 10) / 10}g F</span>
        </div>
      )}
      {!ing.foodId && ing.name && (
        <p className="text-[10px] text-slate-600 pl-1">Not linked to Foods DB — macros won't auto-calculate</p>
      )}
    </div>
  );
}
