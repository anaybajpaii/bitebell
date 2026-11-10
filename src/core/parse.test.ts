// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { autoDetect, matchDay, matchMeal, readMenu } from "./parse";

function doc(html: string): Document {
  return new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
}

const DAYS_AS_COLUMNS = `
  <nav><a>Home</a> <a>About</a></nav>
  <table id="menu">
    <tr><th>Meal</th><th>Monday</th><th>Tuesday</th><th>Wednesday</th></tr>
    <tr><td>Breakfast</td><td>Idli, Sambar</td><td>Poha</td><td>Aloo Paratha</td></tr>
    <tr><td>Lunch</td><td>Rice, Dal</td><td>Roti, Paneer</td><td>Veg Biryani</td></tr>
    <tr><td>Evening Snacks</td><td>Samosa</td><td>Biscuits</td><td>-</td></tr>
    <tr><td>Dinner</td><td>Chapati, Kurma</td><td>Fried Rice</td><td>Pasta</td></tr>
  </table>`;

const DAYS_AS_ROWS = `
  <table>
    <tr><th>Day</th><th>Breakfast</th><th>Lunch</th><th>Snacks</th><th>Dinner</th></tr>
    <tr><td>Mon 3 Nov</td><td>Idli</td><td>Rice, Dal</td><td>Samosa</td><td>Chapati</td></tr>
    <tr><td>Tue 4 Nov</td><td>Poha</td><td>Roti</td><td>Tea</td><td>Fried Rice</td></tr>
  </table>`;

describe("matchers", () => {
  it("recognises days and meals", () => {
    expect(matchDay("Tuesday 4 Nov")).toBe(2);
    expect(matchDay("thurs")).toBe(4);
    expect(matchDay("Sunday")).toBe(0);
    expect(matchDay("Monitor")).toBeNull();
    expect(matchMeal("Evening Snacks")).toBe("snacks");
    expect(matchMeal("supper")).toBe("dinner");
    expect(matchMeal("Lunchbox")).toBeNull();
    expect(matchMeal("Tea")).toBeNull();
  });
});

describe("tables", () => {
  it("reads days as columns", () => {
    const m = autoDetect(doc(DAYS_AS_COLUMNS))!;
    expect(m.days[1]).toEqual({ breakfast: "Idli, Sambar", lunch: "Rice, Dal", snacks: "Samosa", dinner: "Chapati, Kurma" });
    expect(m.days[3]).toEqual({ breakfast: "Aloo Paratha", lunch: "Veg Biryani", dinner: "Pasta" }); // "-" is skipped
    expect(m.days[2]?.snacks).toBe("Biscuits");
  });

  it("reads days as rows", () => {
    const m = autoDetect(doc(DAYS_AS_ROWS))!;
    expect(m.days[1]).toEqual({ breakfast: "Idli", lunch: "Rice, Dal", snacks: "Samosa", dinner: "Chapati" });
    expect(m.days[2]?.dinner).toBe("Fried Rice");
  });

  it("picks the menu table over other tables", () => {
    const m = autoDetect(doc(`<table><tr><td>Fees</td><td>100</td></tr><tr><td>Bus</td><td>5</td></tr></table>${DAYS_AS_COLUMNS}`))!;
    expect(m.days[1]?.lunch).toBe("Rice, Dal");
  });

  it("handles colspan header cells", () => {
    const m = autoDetect(
      doc(`<table><tr><th>Meal</th><th colspan="2">Monday</th></tr><tr><td>Lunch</td><td>Rice</td><td>Rice</td></tr></table>`),
    );
    expect(m!.days[1]).toEqual({ lunch: "Rice" });
  });

  it("returns null when there is no menu", () => {
    expect(autoDetect(doc("<p>Welcome to our school</p><table><tr><td>a</td><td>b</td></tr></table>"))).toBeNull();
  });
});

describe("free text", () => {
  it("reads headings followed by items, for a single day", () => {
    const m = autoDetect(doc(`<h2>Today's Menu</h2><h3>Breakfast</h3><ul><li>Poha</li><li>Tea</li></ul><h3>Lunch</h3><ul><li>Rice</li><li>Dal</li></ul>`))!;
    expect(m.days).toEqual({});
    expect(m.fallback).toEqual({ breakfast: "Poha, Tea", lunch: "Rice, Dal" });
  });

  it("reads inline 'Meal: food' lines with day headings", () => {
    const m = autoDetect(doc(`<p>Monday</p><p>Breakfast: Idli, Vada</p><p>Lunch: Rice</p><p>Tuesday</p><p>Breakfast: Poha</p><p>Lunch - Roti</p>`))!;
    expect(m.days[1]).toEqual({ breakfast: "Idli, Vada", lunch: "Rice" });
    expect(m.days[2]).toEqual({ breakfast: "Poha", lunch: "Roti" });
  });
});

describe("selector", () => {
  it("uses the picked element", () => {
    const m = readMenu(doc(`<div id="a">${DAYS_AS_ROWS}</div><div id="b">${DAYS_AS_COLUMNS}</div>`), "#a")!;
    expect(m.days[1]?.breakfast).toBe("Idli");
  });

  it("falls back to auto-detect when the selector matches nothing", () => {
    const m = readMenu(doc(DAYS_AS_COLUMNS), "#gone > table")!;
    expect(m.days[1]?.lunch).toBe("Rice, Dal");
  });

  it("falls back when the selector is invalid", () => {
    expect(readMenu(doc(DAYS_AS_COLUMNS), "###")).not.toBeNull();
  });
});