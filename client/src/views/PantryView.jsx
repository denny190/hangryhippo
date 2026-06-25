import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Package } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../utils/api.js';

const UNITS = ['g', 'ml', 'oz', 'lb', 'cup', 'tbsp', 'tsp', 'piece', 'serving'];

function PantryRow({ item, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: item.name, quantity: item.quantity, unit: item.unit });

  const save = async () => {
    await onUpdate({ ...item, ...form });
    setEditing(false);
  };
  const cancel = () => { setForm({ name: item.name, quantity: item.quantity, unit: item.unit }); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2 border-b border-border/50">
        <input className="input flex-1 text-sm py-1.5" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input className="input w-20 text-sm py-1.5" type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
        <select className="input w-20 text-sm py-1.5" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button onClick={save} className="btn-ghost p-1.5 text-protein"><Check size={14} /></button>
        <button onClick={cancel} className="btn-ghost p-1.5"><X size={14} /></button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="flex-1">
        <span className="text-sm text-slate-200">{item.name}</span>
      </div>
      <span className="text-sm text-slate-400 tabular-nums">
        {item.quantity} <span className="text-slate-600">{item.unit}</span>
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="btn-ghost p-1.5"><Edit2 size={13} /></button>
        <button onClick={onDelete} className="btn-danger p-1.5"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function AddItemForm({ onAdd, onCancel }) {
  const [form, setForm] = useState({ name: '', quantity: '', unit: 'g' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await onAdd({ name: form.name.trim(), quantity: form.quantity || '0', unit: form.unit });
    setForm({ name: '', quantity: '', unit: 'g' });
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2 py-2 border-b border-border/50">
      <input className="input flex-1 text-sm py-1.5" placeholder="Ingredient name" value={form.name} onChange={e => set('name', e.target.value)} required autoFocus />
      <input className="input w-20 text-sm py-1.5" type="number" min="0" placeholder="Qty" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
      <select className="input w-20 text-sm py-1.5" value={form.unit} onChange={e => set('unit', e.target.value)}>
        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <button type="submit" className="btn-primary py-1.5">Add</button>
      <button type="button" className="btn-ghost py-1.5" onClick={onCancel}>Cancel</button>
    </form>
  );
}

export default function PantryView() {
  const { state, dispatch } = useApp();
  const { pantry } = state;
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = pantry.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = async (data) => {
    const item = await api.createPantryItem(data);
    dispatch({ type: 'ADD_PANTRY_ITEM', payload: item });
  };

  const handleUpdate = async (data) => {
    const item = await api.updatePantryItem(data.id, data);
    dispatch({ type: 'UPDATE_PANTRY_ITEM', payload: item });
  };

  const handleDelete = async (id) => {
    await api.deletePantryItem(id);
    dispatch({ type: 'DELETE_PANTRY_ITEM', payload: id });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0 flex items-center gap-2">
        <div className="relative flex-1">
          <input className="input" placeholder="Search pantry…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <Plus size={15} /> Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="card p-4">
          {adding && (
            <AddItemForm onAdd={async (data) => { await handleAdd(data); setAdding(false); }} onCancel={() => setAdding(false)} />
          )}

          {filtered.length === 0 && !adding ? (
            <div className="text-center py-12 text-slate-500">
              <Package size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium text-slate-400">Pantry is empty</p>
              <p className="text-sm mt-1">Add ingredients you have at home</p>
              <button className="btn-primary mt-4" onClick={() => setAdding(true)}>
                <Plus size={15} /> Add ingredient
              </button>
            </div>
          ) : (
            <div>
              {!adding && (
                <div className="flex items-center justify-between mb-1 text-xs text-slate-500 pb-2 border-b border-border/50">
                  <span>Ingredient</span>
                  <span>Quantity</span>
                </div>
              )}
              {filtered.map(item => (
                <PantryRow
                  key={item.id}
                  item={item}
                  onUpdate={handleUpdate}
                  onDelete={() => handleDelete(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {pantry.length > 0 && (
          <p className="text-xs text-slate-600 text-center mt-3">{pantry.length} item{pantry.length !== 1 ? 's' : ''} in pantry</p>
        )}
      </div>
    </div>
  );
}
