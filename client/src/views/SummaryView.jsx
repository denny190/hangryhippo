import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, NotebookPen, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { api, getMacrosForItems } from '../utils/api.js';
import {
  getISOWeek, getWeekDates, getDayIndex,
  cellId, DAYS, MEAL_TYPES, MEAL_LABELS, toLocalDateStr,
} from '../utils/weekUtils.js';
import MacroBar from '../components/summary/MacroBar.jsx';
import QuickLogModal from '../components/summary/QuickLogModal.jsx';
import CalendarPicker from '../components/common/CalendarPicker.jsx';

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export default function SummaryView() {
  const { state, updateCell } = useApp();
  const { recipes, foods, mealPlan, settings, currentWeek } = state;
  const targets = settings.targets;

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [planCache, setPlanCache] = useState({});
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(true);
  const [showQuickLog,  setShowQuickLog]  = useState(false);
  const [showCalendar,  setShowCalendar]  = useState(false);
  const fetchedRef = useRef(new Set([currentWeek]));

  const todayStr   = toLocalDateStr(new Date());
  const selDateStr = toLocalDateStr(selectedDate);
  const selWeekStr = getISOWeek(selectedDate);
  const selDayIdx  = getDayIndex(selectedDate);
  const isToday    = selDateStr === todayStr;

  // Get plan data for any week
  const getPlan = (weekStr) =>
    weekStr === currentWeek ? mealPlan : (planCache[weekStr] ?? {});

  // Fetch weeks needed for selected date + 7-day trend window
  useEffect(() => {
    const needed = [];
    for (let i = 0; i < 7; i++) {
      const w = getISOWeek(addDays(selectedDate, -i));
      if (w !== currentWeek && !fetchedRef.current.has(w)) {
        needed.push(w);
        fetchedRef.current.add(w);
      }
    }
    if (needed.length === 0) return;
    Promise.all(needed.map(w => api.getMealPlan(w).then(p => [w, p ?? {}])))
      .then(pairs => setPlanCache(c => ({ ...c, ...Object.fromEntries(pairs) })));
  }, [selectedDate, currentWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload note when selected date changes
  useEffect(() => {
    setNote('');
    setNoteSaved(true);
    api.getNote(selDateStr).then(({ note: n }) => setNote(n || ''));
  }, [selDateStr]);

  const saveNote = async () => {
    await api.saveNote(selDateStr, note);
    setNoteSaved(true);
  };

  // Macros for selected day
  const selMacros = useMemo(() => {
    const plan = getPlan(selWeekStr);
    return MEAL_TYPES.reduce((acc, meal) => {
      const m = getMacrosForItems(plan[cellId(selDayIdx, meal)] ?? [], recipes, foods);
      acc.kcal += m.kcal; acc.protein += m.protein; acc.carbs += m.carbs; acc.fat += m.fat;
      return acc;
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  }, [selWeekStr, selDayIdx, planCache, mealPlan, recipes, foods]); // eslint-disable-line react-hooks/exhaustive-deps

  // Meals for selected day, broken down by slot
  const selMeals = useMemo(() => {
    const plan = getPlan(selWeekStr);
    return MEAL_TYPES
      .map(meal => ({ meal, items: plan[cellId(selDayIdx, meal)] ?? [] }))
      .filter(({ items }) => items.length > 0);
  }, [selWeekStr, selDayIdx, planCache, mealPlan]); // eslint-disable-line react-hooks/exhaustive-deps

  // 7-day trend: selectedDate going back 6 days
  const trend = useMemo(() => {
    let totalKcal = 0, totalProtein = 0, streak = 0, streakBroken = false;
    for (let i = 0; i < 7; i++) {
      const d      = addDays(selectedDate, -i);
      const w      = getISOWeek(d);
      const dayIdx = getDayIndex(d);
      const plan   = getPlan(w);
      const dayTotals = MEAL_TYPES.reduce((acc, meal) => {
        const m = getMacrosForItems(plan[cellId(dayIdx, meal)] ?? [], recipes, foods);
        acc.kcal += m.kcal; acc.protein += m.protein;
        return acc;
      }, { kcal: 0, protein: 0 });
      totalKcal    += dayTotals.kcal;
      totalProtein += dayTotals.protein;
      if (!streakBroken && dayTotals.protein >= (targets.protein || 1)) streak++;
      else streakBroken = true;
    }
    return {
      avgKcal:    Math.round(totalKcal    / 7),
      avgProtein: Math.round(totalProtein / 7),
      streak,
    };
  }, [selectedDate, planCache, mealPlan, recipes, foods, targets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bar chart: kcal per day for the selected week
  const weekBarData = useMemo(() => {
    const plan      = getPlan(selWeekStr);
    const weekDates = getWeekDates(selWeekStr);
    return DAYS.map((day, i) => ({
      name: day,
      date: toLocalDateStr(weekDates[i]),
      kcal: Math.round(MEAL_TYPES.reduce((acc, meal) =>
        acc + getMacrosForItems(plan[cellId(i, meal)] ?? [], recipes, foods).kcal, 0)),
    }));
  }, [selWeekStr, planCache, mealPlan, recipes, foods]); // eslint-disable-line react-hooks/exhaustive-deps

  const macroRadarData = [
    { subject: 'Calories', value: Math.min((selMacros.kcal    / (targets.kcal    || 1)) * 100, 120) },
    { subject: 'Protein',  value: Math.min((selMacros.protein / (targets.protein || 1)) * 100, 120) },
    { subject: 'Carbs',    value: Math.min((selMacros.carbs   / (targets.carbs   || 1)) * 100, 120) },
    { subject: 'Fat',      value: Math.min((selMacros.fat     / (targets.fat     || 1)) * 100, 120) },
  ];

  const handleQuickLog = (item) => {
    const todayDayIdx = getDayIndex(new Date());
    const todayWeek   = getISOWeek(new Date());
    if (currentWeek !== todayWeek) return;
    const cId = cellId(todayDayIdx, 'snack');
    updateCell(cId, [...(mealPlan[cId] ?? []), item]);
  };

  const navDay = (dir) => {
    const next = addDays(selectedDate, dir);
    if (dir > 0 && toLocalDateStr(next) > todayStr) return;
    setSelectedDate(next);
  };

  const selDayLabel = isToday
    ? 'Today'
    : selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <button onClick={() => navDay(-1)} className="btn-ghost p-1.5">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 text-center">
          <button
            onClick={() => setShowCalendar(true)}
            className="flex items-center justify-center gap-1.5 mx-auto hover:opacity-80 transition-opacity"
          >
            <CalendarDays size={13} className="text-slate-500" />
            <h2 className={`text-base font-semibold ${isToday ? 'text-slate-100' : 'text-slate-300'}`}>
              {selDayLabel}
            </h2>
          </button>
          {!isToday && (
            <button onClick={() => setSelectedDate(new Date())} className="text-[10px] text-accent hover:underline">
              Back to today
            </button>
          )}
        </div>
        <button
          onClick={() => navDay(1)}
          disabled={isToday}
          className={`btn-ghost p-1.5 ${isToday ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          <ChevronRight size={16} />
        </button>
        {isToday && (
          <button className="btn-primary ml-1" onClick={() => setShowQuickLog(true)}>
            <Plus size={14} /> Quick Log
          </button>
        )}
      </div>

      {/* 7-day trend chips */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <div className="text-lg font-bold text-cals tabular-nums">{trend.avgKcal}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">7-day avg kcal</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-lg font-bold text-protein tabular-nums">{trend.avgProtein}g</div>
          <div className="text-[10px] text-slate-500 mt-0.5">7-day avg protein</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-lg font-bold text-accent tabular-nums">{trend.streak} 🔥</div>
          <div className="text-[10px] text-slate-500 mt-0.5">protein streak</div>
        </div>
      </div>

      {/* Macro bars */}
      <div className="card p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {isToday ? 'Daily Progress' : 'Day Summary'}
        </h3>
        {['kcal', 'protein', 'carbs', 'fat'].map(k => (
          <MacroBar key={k} macro={k} current={Math.round(selMacros[k])} target={targets[k]} />
        ))}
      </div>

      {/* Selected day's meals */}
      {selMeals.length > 0 && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Meals</h3>
          <div className="space-y-3">
            {selMeals.map(({ meal, items }) => (
              <div key={meal}>
                <p className="text-xs text-slate-500 font-medium mb-1">{MEAL_LABELS[meal]}</p>
                {items.map((item, i) => {
                  const macros = getMacrosForItems([item], recipes, foods);
                  const label = item.type === 'recipe'
                    ? recipes.find(r => r.id === item.recipeId)?.name ?? 'Unknown recipe'
                    : item.type === 'food'
                      ? (() => {
                          const food = foods.find(f => f.id === item.foodId);
                          return food ? `${food.name} (${item.quantity}${item.unit})` : 'Unknown food';
                        })()
                      : (item.name ?? 'Custom entry');
                  return (
                    <div key={i} className="flex items-center justify-between text-sm py-0.5">
                      <span className="text-slate-300 truncate flex-1 mr-2">{label}</span>
                      <span className="text-slate-500 text-xs shrink-0">{Math.round(macros.kcal)} kcal</span>
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

      {/* Week bar chart — click a bar to navigate to that day */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Week kcal</h3>
          <div className="text-xs text-slate-600">{selWeekStr}</div>
        </div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart
            data={weekBarData}
            barSize={20}
            style={{ cursor: 'pointer' }}
            onClick={(data) => {
              const payload = data?.activePayload?.[0]?.payload;
              if (payload?.date && payload.date <= todayStr) {
                setSelectedDate(new Date(payload.date + 'T12:00:00Z'));
              }
            }}
          >
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: '#131720', border: '1px solid #1e2333', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#a78bfa' }}
            />
            <Bar dataKey="kcal" radius={[4, 4, 0, 0]}>
              {weekBarData.map((entry, i) => (
                <Cell key={i} fill={entry.date === selDateStr ? '#818cf8' : '#a78bfa44'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-slate-600 text-center mt-1">Click a bar to jump to that day</p>
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
      {showCalendar && (
        <CalendarPicker
          mode="day"
          selectedDate={selectedDate}
          onSelect={(date) => setSelectedDate(date)}
          onClose={() => setShowCalendar(false)}
          targets={targets}
          recipes={recipes}
          foods={foods}
        />
      )}
    </div>
  );
}
