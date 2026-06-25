import React, { useState } from 'react';
import { Scan } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import BarcodeModal from './BarcodeModal.jsx';

const UNITS = ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece', 'slice', 'serving'];

function empty() {
  return { name: '', per: '100', unit: 'g', kcal: '', protein: '', carbs: '', fat: '' };
}

export default function FoodForm({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial ? { ...initial } : empty());
  const [showScanner, setShowScanner] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleBarcodeResult = (data) => {
    setForm(f => ({
      ...f,
      name:    data.name    || f.name,
      per:     data.per     ?? f.per,
      unit:    data.unit    || f.unit,
      kcal:    data.kcal    ?? f.kcal,
      protein: data.protein ?? f.protein,
      carbs:   data.carbs   ?? f.carbs,
      fat:     data.fat     ?? f.fat,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      per:     parseFloat(form.per)     || 100,
      kcal:    parseFloat(form.kcal)    || 0,
      protein: parseFloat(form.protein) || 0,
      carbs:   parseFloat(form.carbs)   || 0,
      fat:     parseFloat(form.fat)     || 0,
    });
    onClose();
  };

  return (
    <>
      <Modal title={initial ? 'Edit food' : 'Add food'} onClose={onClose} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + barcode button */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Food name *</label>
              <button
                type="button"
                className="btn-ghost text-xs gap-1 py-1"
                onClick={() => setShowScanner(true)}
              >
                <Scan size={12} /> Scan barcode
              </button>
            </div>
            <input
              className="input"
              required
              placeholder="e.g. Chicken breast"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          {/* Per + unit */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Per (quantity)</label>
              <input
                className="input"
                type="number"
                min="0.01"
                step="any"
                placeholder="100"
                value={form.per}
                onChange={e => set('per', e.target.value)}
              />
            </div>
            <div className="w-28">
              <label className="label">Unit</label>
              <select className="input" value={form.unit} onChange={e => set('unit', e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-500 -mt-2">
            Macros below apply to <strong className="text-slate-300">{form.per || '100'} {form.unit}</strong> of this food.
          </p>

          {/* Macro fields */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'kcal',    label: 'Calories', color: 'text-cals' },
              { k: 'protein', label: 'Protein g', color: 'text-protein' },
              { k: 'carbs',   label: 'Carbs g',   color: 'text-carbs' },
              { k: 'fat',     label: 'Fat g',      color: 'text-fat' },
            ].map(({ k, label, color }) => (
              <div key={k}>
                <label className={`label ${color}`}>{label}</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={form[k]}
                  onChange={e => set(k, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-ghost flex-1 justify-center" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center">{initial ? 'Save' : 'Add food'}</button>
          </div>
        </form>
      </Modal>

      {showScanner && (
        <BarcodeModal
          onFound={handleBarcodeResult}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}
