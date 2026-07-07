export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

export function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function getWeekDates(weekStr) {
  const [year, week] = weekStr.split('-W').map(Number);
  // Find the Monday of ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  const weekMon = new Date(week1Mon);
  weekMon.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekMon);
    d.setUTCDate(weekMon.getUTCDate() + i);
    return d;
  });
}

export function prevWeek(weekStr) {
  const dates = getWeekDates(weekStr);
  const d = new Date(dates[0]);
  d.setUTCDate(d.getUTCDate() - 1);
  return getISOWeek(d);
}

export function nextWeek(weekStr) {
  const dates = getWeekDates(weekStr);
  const d = new Date(dates[6]);
  d.setUTCDate(d.getUTCDate() + 1);
  return getISOWeek(d);
}

export function toLocalDateStr(utcDate) {
  return utcDate.toISOString().split('T')[0];
}

export function getTodayDayIndex() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

export function getDayIndex(date) {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

export function cellId(dayIndex, mealType) {
  return `${dayIndex}_${mealType}`;
}
