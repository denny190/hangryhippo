import React from 'react';
import { useApp } from './context/AppContext.jsx';
import Navigation from './components/Navigation.jsx';
import PlannerView from './views/PlannerView.jsx';
import RecipesView from './views/RecipesView.jsx';
import SummaryView from './views/SummaryView.jsx';
import SettingsView from './views/SettingsView.jsx';
import LoginView from './views/LoginView.jsx';

const VIEWS = {
  planner:  PlannerView,
  recipes:  RecipesView,
  summary:  SummaryView,
  settings: SettingsView,
};

export default function App() {
  const { state } = useApp();
  const { view, loading, user } = state;
  const View = VIEWS[view] ?? PlannerView;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-base">
        <div className="text-center space-y-3">
          <div className="text-2xl font-bold text-accent tracking-widest">FUELOS</div>
          <div className="flex gap-1 justify-center">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <LoginView />;

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-base overflow-hidden">
      <div className="order-2 lg:order-1">
        <Navigation />
      </div>
      <main className="order-1 lg:order-2 flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center px-4 py-3 border-b border-border bg-card shrink-0">
          <span className="text-accent font-bold text-lg tracking-widest">FUELOS</span>
          <span className="ml-3 text-xs text-slate-500 capitalize">{view}</span>
        </header>
        <div className="flex-1 overflow-hidden flex flex-col">
          <View />
        </div>
      </main>
    </div>
  );
}
