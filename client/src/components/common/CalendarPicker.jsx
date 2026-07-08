import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getISOWeek, getDayIndex, cellId, MEAL_TYPES, toLocalDateStr } from '../../utils/weekUtils.js';
import { api, getMacrosForItems } from '../../utils/api.js';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7; // 0 = Mon
  const start = new Date(year, month, 1 - offset);
  const days = [];
  const cur = new Date(start);
  while (days.length < 35 || cur.getMonth() === month) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
    if (days.length >= 42) break;
  }
  return days;
}

function chunkWeeks(days) {
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export default function CalendarPicker({ selectedDate, onSelect, onClose, mode = 'day', targets, recipes, foods }) {
  const today = new Date();
  const todayStr = toLocalDateStr(today);

  const [viewYear,  setViewYear]  = useState(() => selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selectedDate.getMonth());
  const [planCache, setPlanCache] = useState({});
  const fetchedRef = useRef(new Set());

  const selDateStr = toLocalDateStr(selectedDate);
  const selWeekStr = getISOWeek(selectedDate);

  const days  = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const weeks = useMemo(() => chunkWeeks(days), [days]);

  // Fetch all weeks visible in the current month grid
  useEffect(() => {
    const needed = [...new Set(days.map(d => getISOWeek(d)))]
      .filter(w => !fetchedRef.current.has(w));
    needed.forEach(w => fetchedRef.current.add(w));
    if (!needed.length) return;
    Promise.all(needed.map(w => api.getMealPlan(w).then(p => [w, p ?? {}])))
      .then(pairs => setPlanCache(c => ({ ...c, ...Object.fromEntries(pairs) })));
  }, [viewYear, viewMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const getDayKcal = (date) => {
    if (toLocalDateStr(date) > todayStr) return 0;
    const plan   = planCache[getISOWeek(date)] ?? {};
    const dayIdx = getDayIndex(date);
    return MEAL_TYPES.reduce(
      (acc, meal) => acc + getMacrosForItems(plan[cellId(dayIdx, meal)] ?? [], recipes, foods).kcal,
      0,
    );
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
    if (new Date(nextY, nextM, 1) > today) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const isAtCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const targetKcal = targets?.kcal || 1;

  const handleSelect = (date) => {
    if (toLocalDateStr(date) > todayStr) return;
    onSelect(date);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="card p-4 shadow-2xl w-72" onClick={e => e.stopPropagation()}>

        {/* Month nav */}
        <div className="flex items-center gap-1 mb-3">
          <button onClick={prevMonth} className="btn-ghost p-1.5"><ChevronLeft size={14} /></button>
          <span className="flex-1 text-center text-sm font-semibold text-slate-200">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            disabled={isAtCurrentMonth}
            className={`btn-ghost p-1.5 ${isAtCurrentMonth ? 'opacity-20 cursor-not-allowed' : ''}`}
          >
            <ChevronRight size={14} />
          </button>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={14} /></button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DOW.map(d => (
            <div key={d} className="text-[9px] text-slate-600 text-center font-semibold uppercase tracking-wide py-0.5">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="space-y-0.5">
          {weeks.map((week, wi) => {
            const weekStr    = getISOWeek(week[0]);
            const isSelWeek  = mode === 'week' && weekStr === selWeekStr;

            return (
              <div
                key={wi}
                className={`grid grid-cols-7 rounded-lg transition-colors ${isSelWeek ? 'bg-accent/10 ring-1 ring-inset ring-accent/20' : ''}`}
              >
                {week.map((date, di) => {
                  const dateStr    = toLocalDateStr(date);
                  const isCurMonth = date.getMonth() === viewMonth;
                  const isFuture   = dateStr > todayStr;
                  const isToday    = dateStr === todayStr;
                  const isSel      = mode === 'day' && dateStr === selDateStr;

                  const kcal = getDayKcal(date);
                  const fill = kcal / targetKcal;

                  let dotCls = 'bg-transparent';
                  if (kcal > 0 && isCurMonth && !isFuture) {
                    if (fill >= 0.8 && fill <= 1.15) dotCls = 'bg-green-400';
                    else if (fill >= 0.5)             dotCls = 'bg-yellow-400';
                    else                              dotCls = 'bg-slate-500';
                  }

                  return (
                    <button
                      key={di}
                      disabled={isFuture || !isCurMonth}
                      onClick={() => handleSelect(date)}
                      className={[
                        'flex flex-col items-center py-1 rounded-md transition-colors',
                        !isCurMonth  ? 'opacity-0 pointer-events-none' : '',
                        isFuture     ? 'opacity-25 cursor-not-allowed' : 'hover:bg-white/8',
                        isSel        ? 'bg-accent/30 ring-1 ring-accent/60' : '',
                        isToday && !isSel ? 'ring-1 ring-accent/40' : '',
                      ].join(' ')}
                    >
                      <span className={`text-xs leading-none ${
                        isToday ? 'text-accent font-bold'
                        : isSel ? 'text-white font-semibold'
                        : 'text-slate-300'
                      }`}>
                        {date.getDate()}
                      </span>
                      <span className={`w-1 h-1 rounded-full mt-0.5 ${dotCls}`} />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3 pt-2.5 border-t border-border">
          {[
            { cls: 'bg-green-400',  label: 'On target' },
            { cls: 'bg-yellow-400', label: 'Partial' },
            { cls: 'bg-slate-500',  label: 'Light' },
          ].map(({ cls, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${cls}`} />
              <span className="text-[9px] text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
