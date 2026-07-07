import React from 'react';
import { CalendarDays, BookOpen, BarChart2, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

const TABS = [
  { id: 'planner',  label: 'Planner',  Icon: CalendarDays },
  { id: 'recipes',  label: 'Recipes',  Icon: BookOpen },
  { id: 'summary',  label: 'Summary',  Icon: BarChart2 },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export default function Navigation() {
  const { state, dispatch } = useApp();
  const { view } = state;

  return (
    <nav className="shrink-0 border-t border-border bg-card lg:border-t-0 lg:border-r lg:w-16 lg:flex-col">
      {/* Mobile bottom bar */}
      <div className="flex lg:hidden">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => dispatch({ type: 'SET_VIEW', payload: id })}
            className={`flex flex-col items-center justify-center flex-1 py-2 gap-0.5 transition-colors
              ${view === id ? 'text-accent' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Icon size={20} />
            <span className="text-[9px] font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* Desktop sidebar icons */}
      <div className="hidden lg:flex flex-col items-center py-4 gap-1">
        <div className="text-accent font-bold text-xs tracking-widest mb-4 [writing-mode:vertical-lr] rotate-180 select-none">
          HangryHippo
        </div>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            title={label}
            onClick={() => dispatch({ type: 'SET_VIEW', payload: id })}
            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-colors w-12
              ${view === id ? 'bg-accent/15 text-accent' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
          >
            <Icon size={20} />
            <span className="text-[8px] font-medium leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
