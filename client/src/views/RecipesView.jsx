import React, { useState, useMemo } from 'react';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../utils/api.js';
import RecipeCard from '../components/recipes/RecipeCard.jsx';
import RecipeForm from '../components/recipes/RecipeForm.jsx';
import FoodsList from '../components/recipes/FoodsList.jsx';

const MEAL_TYPES = ['all', 'breakfast', 'lunch', 'dinner', 'snack'];
const TABS = ['Recipes', 'Foods'];

export default function RecipesView() {
  const { state, dispatch } = useApp();
  const { recipes, pantry } = state;

  const [activeTab, setActiveTab] = useState('Recipes');
  const [search, setSearch] = useState('');
  const [mealFilter, setMealFilter] = useState('all');
  const [ingFilter, setIngFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editRecipe, setEditRecipe] = useState(null);

  const filtered = useMemo(() => recipes.filter(r => {
    if (mealFilter !== 'all' && r.mealType !== mealFilter) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (ingFilter) {
      const has = r.ingredients?.some(i => i.name.toLowerCase().includes(ingFilter.toLowerCase()));
      if (!has) return false;
    }
    return true;
  }), [recipes, search, mealFilter, ingFilter]);

  const handleCreate = async (data) => {
    const recipe = await api.createRecipe(data);
    dispatch({ type: 'ADD_RECIPE', payload: recipe });
  };

  const handleUpdate = async (data) => {
    const recipe = await api.updateRecipe(data.id, data);
    dispatch({ type: 'UPDATE_RECIPE', payload: recipe });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this recipe?')) return;
    await api.deleteRecipe(id);
    dispatch({ type: 'DELETE_RECIPE', payload: id });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-0 px-4 pt-3 border-b border-border shrink-0">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? 'border-accent text-accent'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
        {activeTab === 'Recipes' && (
          <div className="ml-auto mb-1">
            <button className="btn-primary" onClick={() => setFormOpen(true)}>
              <Plus size={14} /> Add recipe
            </button>
          </div>
        )}
      </div>

      {/* Foods sub-tab */}
      {activeTab === 'Foods' && <FoodsList />}

      {/* Recipes sub-tab */}
      {activeTab === 'Recipes' && (
        <>
          <div className="px-4 pt-3 pb-3 border-b border-border space-y-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input className="input pl-8" placeholder="Search recipes…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button className="btn-ghost p-2" onClick={() => setShowFilters(f => !f)}>
                <SlidersHorizontal size={16} className={showFilters ? 'text-accent' : ''} />
              </button>
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {MEAL_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setMealFilter(t)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${mealFilter === t ? 'bg-accent text-white' : 'bg-white/5 text-slate-400 hover:text-slate-200'}`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {showFilters && (
              <div>
                <label className="label">Filter by ingredient</label>
                <input className="input" placeholder="e.g. chicken" value={ingFilter} onChange={e => setIngFilter(e.target.value)} />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="text-4xl mb-3">🍽️</p>
                <p className="text-base font-medium text-slate-400">No recipes yet</p>
                <p className="text-sm mt-1">Add your first recipe to get started</p>
                <button className="btn-primary mt-4" onClick={() => setFormOpen(true)}>
                  <Plus size={15} /> Add Recipe
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(recipe => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    pantry={pantry}
                    onEdit={() => setEditRecipe(recipe)}
                    onDelete={() => handleDelete(recipe.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {formOpen && <RecipeForm onClose={() => setFormOpen(false)} onSave={handleCreate} />}
      {editRecipe && <RecipeForm initial={editRecipe} onClose={() => setEditRecipe(null)} onSave={handleUpdate} />}
    </div>
  );
}
