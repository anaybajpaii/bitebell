import { describe, expect, it } from "vitest";
import { nextMeal, notificationText, plan } from "./schedule";
import { DEFAULT_SETTINGS, type Menu } from "./types";

const menu: Menu = {
  fetchedAt: 0,
  days: {
    4: { breakfast: "Poha", lunch: "Roti, Paneer", snacks: "Biscuits", dinner: "Fried Rice" },
    5: { breakfast: "Idli, Sambar", lunch: "Rice, Dal", dinner: "Chapati" },
  },
};
const at = (h: number, m = 0, day = 5) => new Date(2026, 10, day, h, m, 0, 0);

describe("plan", () => {
  it("notifies 90 minutes before lunch and dinner, and the evening before for breakfast", () => {
    const p = plan(menu, DEFAULT_SETTINGS, at(7));
    const find = (id: string) => p.find((x) => x.id === id);
    expect(new Date(find("meal:2026-11-05:lunch")!.when)).toEqual(at(11, 30));
    expect(new Date(find("meal:2026-11-05:dinner")!.when)).toEqual(at(18, 30));
    expect(new Date(find("meal:2026-11-06:breakfast")!.when)).toEqual(at(21, 0));
  });

  it("does not schedule things in the past", () => {
    const p = plan(menu, DEFAULT_SETTINGS, at(12));
    expect(p.find((x) => x.id === "meal:2026-11-05:lunch")).toBeUndefined();
    expect(p.find((x) => x.id === "meal:2026-11-05:dinner")).toBeDefined();
  });

  it("skips meals with no menu entry and respects the off switch", () => {
    expect(plan(menu, DEFAULT_SETTINGS, at(7)).some((x) => x.id === "meal:2026-11-06:snacks")).toBe(false);
    expect(plan(menu, { ...DEFAULT_SETTINGS, notificationsOn: false }, at(7))).toEqual([]);
    expect(plan(null, DEFAULT_SETTINGS, at(7))).toEqual([]);
  });

  it("uses a no-day fallback menu for every day", () => {
    const p = plan({ days: {}, fallback: { lunch: "Rice" }, fetchedAt: 0 }, DEFAULT_SETTINGS, at(7));
    expect(p.map((x) => x.id)).toContain("meal:2026-11-05:lunch");
    expect(p.map((x) => x.id)).toContain("meal:2026-11-06:lunch");
  });

  it("builds the notification text", () => {
    const [lunch] = plan(menu, DEFAULT_SETTINGS, at(7));
    expect(notificationText(menu, DEFAULT_SETTINGS, lunch!)).toEqual({ title: "Lunch at 1:00 PM", message: "Roti, Paneer" });
    const breakfast = plan(menu, DEFAULT_SETTINGS, at(7)).find((x) => x.meal === "breakfast")!;
    expect(notificationText(menu, DEFAULT_SETTINGS, breakfast)).toEqual({ title: "Tomorrow's breakfast (8:00 AM)", message: "Idli, Sambar" });
  });
});

describe("nextMeal", () => {
  it("shows the upcoming meal today", () => {
    expect(nextMeal(menu, DEFAULT_SETTINGS, at(9))).toMatchObject({ meal: "lunch", dayLabel: "Today", food: "Roti, Paneer" });
  });
  it("keeps a meal visible for 30 minutes after it starts", () => {
    expect(nextMeal(menu, DEFAULT_SETTINGS, at(13, 20))?.meal).toBe("lunch");
    expect(nextMeal(menu, DEFAULT_SETTINGS, at(13, 40))?.meal).toBe("snacks");
  });
  it("rolls over to tomorrow's first meal after dinner", () => {
    expect(nextMeal(menu, DEFAULT_SETTINGS, at(22))).toMatchObject({ meal: "breakfast", dayLabel: "Tomorrow", food: "Idli, Sambar" });
  });
  it("returns null with no menu", () => {
    expect(nextMeal(null, DEFAULT_SETTINGS, at(9))).toBeNull();
  });
});