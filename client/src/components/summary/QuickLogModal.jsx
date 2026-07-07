import React, { useState } from 'react';
import Modal from '../common/Modal.jsx';

// inline uuid to avoid extra import issues — just generate random id
function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const empty = { name: '', kcal: '', protein: '', carbs: '', fat: '' };

export default function QuickLogModal({ onClose, onAdd, title = 'Quick Log', submitLabel = 'Add to today' }) {
  const [form, setForm] = useState(empty);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAdd({
      type: 'quicklog',
      id: genId(),
      name: form.name.trim(),
      kcal: parseFloat(form.kcal) || 0,
      protein: parseFloat(form.protein) || 0,
      carbs: parseFloat(form.carbs) || 0,
      fat: parseFloat(form.fat) || 0,
    });
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Meal name</label>
          <input className="input" placeholder="e.g. Greek yogurt snack" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {['kcal', 'protein', 'carbs', 'fat'].map(k => (
            <div key={k}>
              <label className="label capitalize">{k === 'kcal' ? 'Calories (kcal)' : `${k} (g)`}</label>
              <input className="input" type="number" min="0" placeholder="0" value={form[k]} onChange={e => set(k, e.target.value)} />
            </div>
          ))}
        </div>
        <button type="submit" className="btn-primary w-full justify-center py-2">{submitLabel}</button>
      </form>
    </Modal>
  );
}
