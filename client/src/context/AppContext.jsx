import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { api } from '../utils/api';
import { getISOWeek } from '../utils/weekUtils';

const AppContext = createContext(null);

const initialState = {
  view: 'planner',
  user: null,
  recipes: [],
  foods: [],
  currentWeek: getISOWeek(),
  mealPlan: {},
  settings: { targets: { kcal: 2000, protein: 150, carbs: 200, fat: 65 } },
  loading: true,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_VIEW':    return { ...state, view: action.payload };
    case 'SET_LOADING': return { ...state, loading: action.payload };
    case 'SET_USER':    return { ...state, user: action.payload };

    case 'SET_RECIPES':   return { ...state, recipes: action.payload };
    case 'ADD_RECIPE':    return { ...state, recipes: [...state.recipes, action.payload] };
    case 'UPDATE_RECIPE': return { ...state, recipes: state.recipes.map(r => r.id === action.payload.id ? action.payload : r) };
    case 'DELETE_RECIPE': return { ...state, recipes: state.recipes.filter(r => r.id !== action.payload) };

    case 'SET_FOODS':    return { ...state, foods: action.payload };
    case 'ADD_FOOD':     return { ...state, foods: [...state.foods, action.payload] };
    case 'UPDATE_FOOD':  return { ...state, foods: state.foods.map(f => f.id === action.payload.id ? action.payload : f) };
    case 'DELETE_FOOD':  return { ...state, foods: state.foods.filter(f => f.id !== action.payload) };

    case 'SET_WEEK':      return { ...state, currentWeek: action.payload, mealPlan: {} };
    case 'SET_MEAL_PLAN': return { ...state, mealPlan: action.payload };

    case 'SET_SETTINGS': return { ...state, settings: action.payload };

    case 'CLEAR_USER_DATA': return {
      ...state,
      user: null,
      recipes: [],
      foods: [],
      mealPlan: {},
      settings: initialState.settings,
    };

    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const [recipes, foods, settings] = await Promise.all([
        api.getRecipes(),
        api.getFoods(),
        api.getSettings(),
      ]);
      dispatch({ type: 'SET_RECIPES',  payload: recipes });
      dispatch({ type: 'SET_FOODS',    payload: foods });
      dispatch({ type: 'SET_SETTINGS', payload: settings });
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Auth: check existing session on mount, then listen for changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      dispatch({ type: 'SET_USER', payload: user });
      if (user) {
        loadData();
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      dispatch({ type: 'SET_USER', payload: user });
      if (user) {
        loadData();
      } else {
        dispatch({ type: 'CLEAR_USER_DATA' });
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    });

    return () => subscription.unsubscribe();
  }, [loadData]);

  // Load meal plan whenever the viewed week changes (and user is authed)
  useEffect(() => {
    if (!state.user) return;
    api.getMealPlan(state.currentWeek)
      .then(plan => dispatch({ type: 'SET_MEAL_PLAN', payload: plan }))
      .catch(console.error);
  }, [state.currentWeek, state.user]);

  const updateCell = useCallback(async (cellId, items) => {
    const newPlan = { ...state.mealPlan, [cellId]: items };
    dispatch({ type: 'SET_MEAL_PLAN', payload: newPlan });
    await api.saveMealPlan(state.currentWeek, newPlan);
  }, [state.mealPlan, state.currentWeek]);

  const saveMealPlan = useCallback(async (newPlan) => {
    dispatch({ type: 'SET_MEAL_PLAN', payload: newPlan });
    await api.saveMealPlan(state.currentWeek, newPlan);
  }, [state.currentWeek]);

  return (
    <AppContext.Provider value={{ state, dispatch, updateCell, saveMealPlan }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
