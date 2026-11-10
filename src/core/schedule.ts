import { MEAL_KEYS, MEAL_LABEL, type DayMeals, type MealKey, type Menu, type PlannedNotification, type Settings, type Weekday } from "./types";

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number.isFinite(h) ? h! : 0, Number.isFinite(m) ? m! : 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 0, 0, 0, 0);
}

export function mealsFor(menu: Menu | null, day: Date): DayMeals {
  if (!menu) return {};
  const own = menu.days[day.getDay() as Weekday];
  if (own && Object.keys(own).length > 0) return own;
  return menu.fallback ?? {};
}

export function plan(menu: Menu | null, settings: Settings, now: Date, horizonHours = 48): PlannedNotification[] {
  if (!menu || !settings.notificationsOn) return [];
  const out: PlannedNotification[] = [];
  const end = now.getTime() + horizonHours * 3_600_000;
  const today = addDays(now, 0);
  for (let offset = 0; offset <= 3; offset++) {
    const day = addDays(today, offset);
    const meals = mealsFor(menu, day);
    for (const meal of MEAL_KEYS) {
      if (!meals[meal]) continue;
      const mealAt = atTime(day, settings.mealTimes[meal]);
      const when =
        meal === "breakfast"
          ? atTime(addDays(day, -1), settings.breakfastEveningTime).getTime()
          : mealAt.getTime() - settings.leadMinutes * 60_000;
      if (when <= now.getTime() || when > end) continue;
      const date = dateKey(day);
      out.push({ id: `meal:${date}:${meal}`, when, meal, date });
    }
  }
  return out.sort((a, b) => a.when - b.when);
}

export function notificationText(menu: Menu | null, settings: Settings, p: PlannedNotification): { title: string; message: string } | null {
  if (!menu) return null;
  const [y, mo, d] = p.date.split("-").map(Number);
  const day = new Date(y!, (mo ?? 1) - 1, d);
  const food = mealsFor(menu, day)[p.meal];
  if (!food) return null;
  const when = settings.mealTimes[p.meal];
  const label = MEAL_LABEL[p.meal];
  const isTomorrow = p.meal === "breakfast";
  return {
    title: isTomorrow ? `Tomorrow's breakfast (${format12(when)})` : `${label} at ${format12(when)}`,
    message: food,
  };
}

export function format12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = ((h ?? 0) + 11) % 12 + 1;
  return `${hour}:${pad(m ?? 0)} ${(h ?? 0) >= 12 ? "PM" : "AM"}`;
}

export interface NextMeal {
  meal: MealKey;
  dayLabel: "Today" | "Tomorrow";
  time: string;
  food: string;
  all: DayMeals;
}

export function nextMeal(menu: Menu | null, settings: Settings, now: Date, graceMinutes = 30): NextMeal | null {
  if (!menu) return null;
  for (let offset = 0; offset <= 1; offset++) {
    const day = addDays(now, offset);
    const meals = mealsFor(menu, day);
    for (const meal of MEAL_KEYS) {
      const food = meals[meal];
      if (!food) continue;
      const mealAt = atTime(day, settings.mealTimes[meal]).getTime();
      if (mealAt + graceMinutes * 60_000 < now.getTime()) continue;
      return { meal, dayLabel: offset === 0 ? "Today" : "Tomorrow", time: settings.mealTimes[meal], food, all: meals };
    }
  }
  return null;
}