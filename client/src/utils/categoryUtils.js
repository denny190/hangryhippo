const KEYWORDS = {
  Produce: ['tomato', 'lettuce', 'spinach', 'kale', 'onion', 'garlic', 'pepper', 'broccoli', 'carrot', 'celery', 'cucumber', 'zucchini', 'mushroom', 'avocado', 'apple', 'banana', 'berry', 'lemon', 'lime', 'orange', 'potato', 'sweet potato', 'squash', 'asparagus', 'green bean', 'pea', 'corn', 'cabbage', 'cauliflower', 'beet', 'radish', 'arugula', 'basil', 'cilantro', 'parsley', 'ginger', 'leek', 'shallot', 'fennel', 'artichoke', 'eggplant'],
  Protein: ['chicken', 'beef', 'pork', 'turkey', 'salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'egg', 'tofu', 'tempeh', 'lentil', 'bean', 'chickpea', 'lamb', 'steak', 'ground', 'sausage', 'bacon', 'ham', 'fish', 'scallop', 'crab', 'lobster', 'duck', 'veal', 'seitan', 'edamame'],
  Dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'mozzarella', 'parmesan', 'cheddar', 'ricotta', 'cottage', 'ghee', 'whey', 'kefir', 'brie', 'feta', 'gouda'],
  'Dry Goods': ['rice', 'pasta', 'flour', 'oat', 'quinoa', 'bread', 'tortilla', 'cereal', 'granola', 'nut', 'almond', 'walnut', 'cashew', 'peanut', 'seed', 'oil', 'vinegar', 'sauce', 'salt', 'sugar', 'honey', 'syrup', 'protein powder', 'cracker', 'chip', 'canned', 'lentil', 'chickpea', 'couscous', 'barley', 'breadcrumb', 'baking', 'cocoa', 'chocolate'],
};

export function categorizeIngredient(name) {
  const lower = name.toLowerCase();
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    if (words.some(w => lower.includes(w))) return cat;
  }
  return 'Other';
}

export const CATEGORIES = ['Produce', 'Protein', 'Dairy', 'Dry Goods', 'Other'];
