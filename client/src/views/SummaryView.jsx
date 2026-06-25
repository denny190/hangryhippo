import React, { useState, useEffect, useMemo } from 'react';
import { Plus, ChevronDown, ChevronUp, NotebookPen } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { api, getMacrosForItems } from '../utils/api.js';
import { getISOWeek, getWeekDates, getTodayDayIndex, cellId, DAYS, MEAL_TYPES, MEAL_LABELS, toLocalDateStr } from '../utils/weekUtils.js';
import MacroBar from '../components/summary/MacroBar.jsx';
import QuickLogModal from '../components/summary/QuickLogModal.jsx';

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export default function SummaryView() {
  const { state, updateCell } = useApp();
  const { recipes, mealPlan, settings, currentWeek } = state;
  const targets = settings.targets;

  const [showQuickLog, setShowQuickLog] = useState(false);
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(true);
  const todayStr = toLocalDateStr(new Date());
  const todayDayIdx = getTodayDayIndex();
  const todayWeek = getISOWeek();

  // Load note for today
  useEffect(() => {
    api.getNote(todayStr).then(({ note: n }) => setNote(n || ''));
  }, [todayStr]);

  const saveNote = async () => {
    await api.saveNote(todayStr, note);
    setNoteSaved(true);
  };

  // Today's macros — always read from today's week
  const todayMacros = useMemo(() => {
    const todayPlan = currentWeek === todayWeek ? mealPlan : {};
    return MEAL_TYPES.reduce((acc, meal) => {
      const id = cellId(todayDayIdx, meal);
      const items = todayPlan[id] || [];
      const m = getMacrosForItems(items, recipes);
      acc.kcal += m.kcal; acc.protein += m.protein; acc.carbs += m.carbs; acc.fat += m.fat;
      return acc;
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  }, [mealPlan, recipes, todayDayIdx, currentWeek, todayWeek]);

  // Today's meal items broken down by type
  const todayMeals = useMemo(() => {
    const plan = currentWeek === todayWeek ? mealPlan : {};
    return MEAL_TYPES.map(meal => ({
      meal,
      items: plan[cellId(todayDayIdx, meal)] || [],
    })).filter(({ items }) => items.length > 0);
  }, [mealPlan, todayDayIdx, currentWeek, todayWeek]);

  // Weekly per-day kcal (for bar chart)
  const weekData = useMemo(() => DAYS.map((day, i) => ({
    name: day,
    kcal: Math.round(MEAL_TYPES.reduce((acc, meal) => {
      return acc + getMacrosForItems(mealPlan[cellId(i, meal)] || [], recipes).kcal;
    }, 0)),
  })), [mealPlan, recipes]);

  const weeklyAvgKcal = Math.round(weekData.reduce((a, d) => a + d.kcal, 0) / 7);
  const weeklyAvgProtein = useMemo(() => {
    const total = DAYS.reduce((acc, _, i) => {
      return acc + MEAL_TYPES.reduce((a, meal) => a + getMacrosForItems(mealPlan[cellId(i, meal)] || [], recipes).protein, 0);
    }, 0);
    return Math.round(total / 7);
  }, [mealPlan, recipes]);

  // Add quick log to today's snack cell (or whichever is closest)
  const handleQuickLog = (item) => {
    const cId = cellId(todayDayIdx, 'snack');
    const existing = currentWeek === todayWeek ? (mealPlan[cId] || []) : [];
    updateCell(cId, [...existing, item]);
  };

  const macroRadarData = [
    { subject: 'Calories', value: Math.min((todayMacros.kcal / targets.kcal) * 100, 120) },
    { subject: 'Protein', value: Math.min((todayMacros.protein / targets.protein) * 100, 120) },
    { subject: 'Carbs', value: Math.min((todayMacros.carbs / targets.carbs) * 100, 120) },
    { subject: 'Fat', value: Math.min((todayMacros.fat / targets.fat) * 100, 120) },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Today header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Today</h2>
          <p className="text-xs text-slate-500">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowQuickLog(true)}>
          <Plus size={14} /> Quick Log
        </button>
      </div>

      {/* Macro bars */}
      <div className="card p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Daily Progress</h3>
        {['kcal', 'protein', 'carbs', 'fat'].map(k => (
          <MacroBar key={k} macro={k} current={Math.round(todayMacros[k])} target={targets[k]} />
        ))}
      </div>

      {/* Today's meals */}
      {todayMeals.length > 0 && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Today's Meals</h3>
          <div className="space-y-3">
            {todayMeals.map(({ meal, items }) => (
              <div key={meal}>
                <p className="text-xs text-slate-500 font-medium mb-1">{MEAL_LABELS[meal]}</p>
                {items.map((item, i) => {
                  const macros = getMacrosForItems([item], recipes);
                  const label = item.type === 'recipe'
                    ? recipes.find(r => r.id === item.recipeId)?.name ?? 'Unknown'
                    : item.name;
                  return (
                    <div key={i} className="flex items-center justify-between text-sm py-1">
                      <span className="text-slate-300">{label}</span>
                      <span className="text-slate-500 text-xs">{Math.round(macros.kcal)} kcal</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Macro radar */}
      <div className="card p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Target coverage (%)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={macroRadarData}>
            <PolarGrid stroke="#1e2333" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
            <Radar dataKey="value" stroke="#818cf8" fill="#818cf8" fillOpacity={0.2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly bar chart */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Week kcal</h3>
          <div className="flex gap-4 text-xs text-slate-500">
            <span>Avg: <span className="text-cals font-medium">{weeklyAvgKcal}</span> kcal</span>
            <span>Protein: <span className="text-protein font-medium">{weeklyAvgProtein}g</span></span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={weekData} barSize={20}>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: '#131720', border: '1px solid #1e2333', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#a78bfa' }}
            />
            <Bar dataKey="kcal" radius={[4, 4, 0, 0]}>
              {weekData.map((entry, i) => (
                <Cell key={i} fill={i === todayDayIdx && currentWeek === todayWeek ? '#818cf8' : '#a78bfa44'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Day note */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-2">
          <NotebookPen size={14} className="text-slate-500" />
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Day note</h3>
        </div>
        <textarea
          className="input resize-none min-h-[80px] text-sm"
          placeholder="Energy level, digestion, mood…"
          value={note}
          onChange={e => { setNote(e.target.value); setNoteSaved(false); }}
        />
        <div className="flex items-center justify-end mt-2 gap-2">
          {!noteSaved && <span className="text-xs text-slate-500">Unsaved</span>}
          <button className="btn-primary text-xs py-1.5" onClick={saveNote}>Save note</button>
        </div>
      </div>

      {showQuickLog && (
        <QuickLogModal onClose={() => setShowQuickLog(false)} onAdd={handleQuickLog} />
      )}
    </div>
  );
}
