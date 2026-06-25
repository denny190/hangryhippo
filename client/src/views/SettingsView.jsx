import React, { useState, useRef } from 'react';
import { Download, Upload, Save } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../utils/api.js';

export default function SettingsView() {
  const { state, dispatch } = useApp();
  const { settings } = state;
  const [targets, setTargets] = useState({ ...settings.targets });
  const [saved, setSaved] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const fileRef = useRef();

  const setTarget = (k, v) => setTargets(t => ({ ...t, [k]: parseFloat(v) || 0 }));

  const saveSettings = async () => {
    const newSettings = { ...settings, targets };
    const saved = await api.saveSettings(newSettings);
    dispatch({ type: 'SET_SETTINGS', payload: saved });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.importDb(data);
      // Reload state
      const [recipes, pantry, settings] = await Promise.all([
        api.getRecipes(), api.getPantry(), api.getSettings(),
      ]);
      dispatch({ type: 'SET_RECIPES', payload: recipes });
      dispatch({ type: 'SET_PANTRY', payload: pantry });
      dispatch({ type: 'SET_SETTINGS', payload: settings });
      setTargets({ ...settings.targets });
      alert('Import successful!');
    } catch (err) {
      setImportError('Invalid backup file. Please select a valid fuelos-backup.json.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const macroFields = [
    { k: 'kcal', label: 'Daily Calories', unit: 'kcal', color: 'text-cals', placeholder: '2000' },
    { k: 'protein', label: 'Protein', unit: 'g/day', color: 'text-protein', placeholder: '150' },
    { k: 'carbs', label: 'Carbohydrates', unit: 'g/day', color: 'text-carbs', placeholder: '200' },
    { k: 'fat', label: 'Fat', unit: 'g/day', color: 'text-fat', placeholder: '65' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full">
      {/* Macro targets */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Daily Macro Targets</h2>
        {macroFields.map(({ k, label, unit, color, placeholder }) => (
          <div key={k}>
            <label className={`label ${color}`}>{label}</label>
            <div className="flex items-center gap-2">
              <input
                className="input flex-1"
                type="number"
                min="0"
                placeholder={placeholder}
                value={targets[k]}
                onChange={e => setTarget(k, e.target.value)}
              />
              <span className="text-sm text-slate-500 w-14">{unit}</span>
            </div>
          </div>
        ))}
        <button className="btn-primary w-full justify-center" onClick={saveSettings}>
          <Save size={14} /> {saved ? 'Saved ✓' : 'Save targets'}
        </button>
      </div>

      {/* Data management */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Data</h2>

        <div>
          <p className="text-xs text-slate-400 mb-2">Export a full backup of all your recipes, pantry, meal plans and notes.</p>
          <button className="btn-ghost w-full justify-center border border-border" onClick={api.exportDb}>
            <Download size={14} /> Export backup (JSON)
          </button>
        </div>

        <div className="border-t border-border pt-3">
          <p className="text-xs text-slate-400 mb-2">Import a previously exported backup. This will overwrite all current data.</p>
          <button
            className="btn-ghost w-full justify-center border border-border"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <Upload size={14} /> {importing ? 'Importing…' : 'Import backup (JSON)'}
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          {importError && <p className="text-xs text-red-400 mt-2">{importError}</p>}
        </div>
      </div>

      {/* App info */}
      <div className="card p-5 text-center space-y-1">
        <p className="text-sm font-bold text-accent tracking-wide">FuelOS</p>
        <p className="text-xs text-slate-500">Personal nutrition tracker · self-hosted · no auth</p>
        <p className="text-xs text-slate-600">Data stored locally in db.json</p>
      </div>
    </div>
  );
}
