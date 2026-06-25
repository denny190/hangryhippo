import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { getISOWeek } from '../utils/weekUtils';

const AppContext = createContext(null);

const initialState = {
  view: 'planner',
  recipes: [],
  pantry: [],
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

    // Recipes
    case 'SET_RECIPES':    return { ...state, recipes: action.payload };
    case 'ADD_RECIPE':     return { ...state, recipes: [...state.recipes, action.payload] };
    case 'UPDATE_RECIPE':  return { ...state, recipes: state.recipes.map(r => r.id === action.payload.id ? action.payload : r) };
    case 'DELETE_RECIPE':  return { ...state, recipes: state.recipes.filter(r => r.id !== action.payload) };

    // Foods
    case 'SET_FOODS':    return { ...state, foods: action.payload };
    case 'ADD_FOOD':     return { ...state, foods: [...state.foods, action.payload] };
    case 'UPDATE_FOOD':  return { ...state, foods: state.foods.map(f => f.id === action.payload.id ? action.payload : f) };
    case 'DELETE_FOOD':  return { ...state, foods: state.foods.filter(f => f.id !== action.payload) };

    // Pantry
    case 'SET_PANTRY':         return { ...state, pantry: action.payload };
    case 'ADD_PANTRY_ITEM':    return { ...state, pantry: [...state.pantry, action.payload] };
    case 'UPDATE_PANTRY_ITEM': return { ...state, pantry: state.pantry.map(i => i.id === action.payload.id ? action.payload : i) };
    case 'DELETE_PANTRY_ITEM': return { ...state, pantry: state.pantry.filter(i => i.id !== action.payload) };

    // Meal plan
    case 'SET_WEEK':     return { ...state, currentWeek: action.payload, mealPlan: {} };
    case 'SET_MEAL_PLAN': return { ...state, mealPlan: action.payload };

    // Settings
    case 'SET_SETTINGS': return { ...state, settings: action.payload };

    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    Promise.all([api.getRecipes(), api.getPantry(), api.getFoods(), api.getSettings()])
      .then(([recipes, pantry, foods, settings]) => {
        dispatch({ type: 'SET_RECIPES',  payload: recipes });
        dispatch({ type: 'SET_PANTRY',   payload: pantry });
        dispatch({ type: 'SET_FOODS',    payload: foods });
        dispatch({ type: 'SET_SETTINGS', payload: settings });
      })
      .catch(console.error)
      .finally(() => dispatch({ type: 'SET_LOADING', payload: false }));
  }, []);

  useEffect(() => {
    api.getMealPlan(state.currentWeek)
      .then(plan => dispatch({ type: 'SET_MEAL_PLAN', payload: plan }))
      .catch(console.error);
  }, [state.currentWeek]);

  const updateCell = useCallback(async (cellId, items) => {
    const newPlan = { ...state.mealPlan, [cellId]: items };
    dispatch({ type: 'SET_MEAL_PLAN', payload: newPlan });
    await api.saveMealPlan(state.currentWeek, newPlan);
  }, [state.mealPlan, state.currentWeek]);

  const saveMealPlan = useCallback(async (newPlan) => {
    dispatch({ type: 'SET_MEAL_PLAN', payload: newPlan });
    await api.saveMealPlan(state.currentWeek, newPlan);
  }, [state.currentWeek]);

  const deductIngredients = useCallback(async (ingredients) => {
    const updatedPantry = state.pantry.map(item => {
      const match = ingredients.find(ing =>
        item.name.toLowerCase().includes(ing.name.toLowerCase()) ||
        ing.name.toLowerCase().includes(item.name.toLowerCase())
      );
      if (!match) return item;
      const newQty = parseFloat(item.quantity || 0) - parseFloat(match.quantity || 0);
      return { ...item, quantity: Math.max(0, newQty) };
    });
    dispatch({ type: 'SET_PANTRY', payload: updatedPantry });
    await Promise.all(updatedPantry.map(item => api.updatePantryItem(item.id, item)));
  }, [state.pantry]);

  return (
    <AppContext.Provider value={{ state, dispatch, updateCell, saveMealPlan, deductIngredients }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
