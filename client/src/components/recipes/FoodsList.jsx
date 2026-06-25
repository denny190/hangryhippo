import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, Salad, Scan } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { api } from '../../utils/api.js';
import FoodForm from './FoodForm.jsx';
import BarcodeModal from './BarcodeModal.jsx';

export default function FoodsList() {
  const { state: { foods }, dispatch } = useApp();
  const [search,      setSearch]      = useState('');
  const [formOpen,    setFormOpen]    = useState(false);
  const [editFood,    setEditFood]    = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  // Pre-fills the FoodForm with barcode result
  const [prefill,     setPrefill]     = useState(null);

  const filtered = foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async (data) => {
    const food = await api.createFood(data);
    dispatch({ type: 'ADD_FOOD', payload: food });
  };

  const handleUpdate = async (data) => {
    const food = await api.updateFood(data.id, data);
    dispatch({ type: 'UPDATE_FOOD', payload: food });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this food? Recipes using it will lose auto-calculated macros for this ingredient.')) return;
    await api.deleteFood(id);
    dispatch({ type: 'DELETE_FOOD', payload: id });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-8 text-sm" placeholder="Search foods…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn-ghost border border-border" onClick={() => setScannerOpen(true)} title="Scan barcode">
          <Scan size={14} />
        </button>
        <button className="btn-primary" onClick={() => { setPrefill(null); setFormOpen(true); }}>
          <Plus size={14} /> Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Salad size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-slate-400">No foods yet</p>
            <p className="text-sm mt-1 max-w-xs mx-auto">
              Add ingredients with their macros. Then in any recipe, pick ingredients from this list and macros calculate automatically.
            </p>
            <button className="btn-primary mt-4" onClick={() => setFormOpen(true)}>
              <Plus size={14} /> Add first food
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-border">
              <span>Name</span>
              <span className="text-right w-20">Per</span>
              <span className="text-right w-14 text-cals">kcal</span>
              <span className="text-right w-14 text-protein">P</span>
              <span className="text-right w-14 text-carbs">C</span>
              <span className="text-right w-14 text-fat">F</span>
            </div>
            {filtered.map(food => (
              <FoodRow
                key={food.id}
                food={food}
                onEdit={() => setEditFood(food)}
                onDelete={() => handleDelete(food.id)}
              />
            ))}
          </div>
        )}
      </div>

      {formOpen && (
        <FoodForm
          initial={prefill ?? undefined}
          onClose={() => { setFormOpen(false); setPrefill(null); }}
          onSave={handleCreate}
        />
      )}
      {editFood && <FoodForm initial={editFood} onClose={() => setEditFood(null)} onSave={handleUpdate} />}

      {scannerOpen && (
        <BarcodeModal
          onFound={(data) => { setPrefill(data); setScannerOpen(false); setFormOpen(true); }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}

function FoodRow({ food, onEdit, onDelete }) {
  return (
    <div className="group grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-white/2 transition-colors">
      <div className="min-w-0 flex items-center gap-2">
        <span className="text-sm text-slate-200 truncate">{food.name}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="btn-ghost p-1"><Edit2 size={11} /></button>
          <button onClick={onDelete} className="btn-danger p-1"><Trash2 size={11} /></button>
        </div>
      </div>
      <span className="text-xs text-slate-500 text-right w-20 tabular-nums">{food.per}{food.unit}</span>
      <span className="text-xs text-cals text-right w-14 tabular-nums font-medium">{food.kcal}</span>
      <span className="text-xs text-protein text-right w-14 tabular-nums">{food.protein}g</span>
      <span className="text-xs text-carbs text-right w-14 tabular-nums">{food.carbs}g</span>
      <span className="text-xs text-fat text-right w-14 tabular-nums">{food.fat}g</span>
    </div>
  );
}
