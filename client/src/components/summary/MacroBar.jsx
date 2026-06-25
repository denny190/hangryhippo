import React from 'react';

const CONFIG = {
  kcal:    { label: 'Calories', color: 'bg-cals',    unit: 'kcal', textColor: 'text-cals' },
  protein: { label: 'Protein',  color: 'bg-protein', unit: 'g',    textColor: 'text-protein' },
  carbs:   { label: 'Carbs',    color: 'bg-carbs',   unit: 'g',    textColor: 'text-carbs' },
  fat:     { label: 'Fat',      color: 'bg-fat',     unit: 'g',    textColor: 'text-fat' },
};

export default function MacroBar({ macro, current, target }) {
  const { label, color, unit, textColor } = CONFIG[macro];
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const ratio = target > 0 ? current / target : 0;
  const indicatorColor = ratio < 0.9 ? 'text-slate-400' : ratio <= 1.1 ? textColor : 'text-red-400';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className={`font-semibold ${indicatorColor}`}>
          {Math.round(current)}<span className="text-slate-500 font-normal">/{target}{unit}</span>
        </span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
