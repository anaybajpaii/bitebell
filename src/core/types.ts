export type MealKey = "breakfast" | "lunch" | "snacks" | "dinner";

export const MEAL_KEYS: MealKey[] = ["breakfast", "lunch", "snacks", "dinner"];

export const MEAL_LABEL: Record<MealKey, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snacks: "Snacks",
  dinner: "Dinner",
};

export type DayMeals = Partial<Record<MealKey, string>>;

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Menu {
  days: Partial<Record<Weekday, DayMeals>>;
  fallback?: DayMeals;
  fetchedAt: number;
}

export interface Settings {
  mealTimes: Record<MealKey, string>;
  leadMinutes: number;
  breakfastEveningTime: string;
  notificationsOn: boolean;
  cardOn: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mealTimes: { breakfast: "08:00", lunch: "13:00", snacks: "16:30", dinner: "20:00" },
  leadMinutes: 90,
  breakfastEveningTime: "21:00",
  notificationsOn: true,
  cardOn: true,
};

export interface Source {
  url: string;
  selector: string | null;
}

export interface PlannedNotification {
  id: string;
  when: number;
  meal: MealKey;
  date: string;
}