import type { DayMeals, MealKey, Menu, Weekday } from "./types";

const DAY_PATTERNS: [RegExp, Weekday][] = [
  [/^(sun(day)?)\b/i, 0],
  [/^(mon(day)?)\b/i, 1],
  [/^(tue(s(day)?)?)\b/i, 2],
  [/^(wed(nesday)?)\b/i, 3],
  [/^(thu(r(s(day)?)?)?)\b/i, 4],
  [/^(fri(day)?)\b/i, 5],
  [/^(sat(urday)?)\b/i, 6],
];

const MEAL_PATTERNS: [RegExp, MealKey][] = [
  [/^(breakfast|bfast|morning\s+meal)\b/i, "breakfast"],
  [/^(lunch)\b/i, "lunch"],
  [/^(evening\s+snacks?|snacks?|tea\s+time|high\s+tea|evening\s+tea)\b/i, "snacks"],
  [/^(dinner|supper)\b/i, "dinner"],
];

export function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

export function matchDay(text: string): Weekday | null {
  const t = clean(text);
  for (const [re, day] of DAY_PATTERNS) if (re.test(t)) return day;
  return null;
}

export function matchMeal(text: string): MealKey | null {
  const t = clean(text);
  for (const [re, meal] of MEAL_PATTERNS) if (re.test(t)) return meal;
  return null;
}

function isDayHeader(text: string): Weekday | null {
  const t = clean(text);
  if (t.length === 0 || t.length > 24) return null;
  return matchDay(t);
}

function isMealHeader(text: string): MealKey | null {
  const t = clean(text);
  if (t.length === 0 || t.length > 24) return null;
  return matchMeal(t);
}

function countMeals(days: Menu["days"], fallback?: DayMeals): number {
  let n = fallback ? Object.keys(fallback).length : 0;
  for (const meals of Object.values(days)) n += Object.keys(meals ?? {}).length;
  return n;
}

export interface ParsedMenu {
  days: Menu["days"];
  fallback?: DayMeals;
  score: number;
}

function put(days: Menu["days"], day: Weekday, meal: MealKey, value: string): void {
  const v = clean(value);
  if (v === "" || /^[-–—.\s]+$/.test(v)) return;
  const entry = (days[day] ??= {});
  const existing = entry[meal];
  if (existing === undefined) entry[meal] = v;
  else if (existing !== v && !existing.endsWith(`, ${v}`)) entry[meal] = `${existing}, ${v}`;
}

export function parseGrid(grid: string[][]): ParsedMenu | null {
  const rows = grid.length;
  if (rows < 2) return null;
  const cols = Math.max(...grid.map((r) => r.length));
  const at = (r: number, c: number): string => clean(grid[r]?.[c]);

  const days: Menu["days"] = {};

  for (let r = 0; r < rows; r++) {
    const dayCols: [number, Weekday][] = [];
    for (let c = 0; c < cols; c++) {
      const d = isDayHeader(at(r, c));
      if (d !== null) dayCols.push([c, d]);
    }
    if (dayCols.length < 2) continue;
    for (let rr = r + 1; rr < rows; rr++) {
      let meal: MealKey | null = null;
      const firstDayCol = dayCols[0]?.[0] ?? cols;
      for (let c = 0; c < firstDayCol; c++) {
        meal = isMealHeader(at(rr, c));
        if (meal) break;
      }
      if (!meal) continue;
      for (const [c, d] of dayCols) put(days, d, meal, at(rr, c));
    }
    const score = countMeals(days);
    if (score > 0) return { days, score };
  }

  for (let r = 0; r < rows; r++) {
    const mealCols: [number, MealKey][] = [];
    for (let c = 0; c < cols; c++) {
      const m = isMealHeader(at(r, c));
      if (m !== null) mealCols.push([c, m]);
    }
    if (mealCols.length < 2) continue;
    const firstMealCol = mealCols[0]?.[0] ?? cols;
    for (let rr = r + 1; rr < rows; rr++) {
      let day: Weekday | null = null;
      for (let c = 0; c < firstMealCol; c++) {
        day = isDayHeader(at(rr, c));
        if (day !== null) break;
      }
      if (day === null) continue;
      for (const [c, m] of mealCols) put(days, day, m, at(rr, c));
    }
    const score = countMeals(days);
    if (score > 0) return { days, score };
  }

  const fallback: DayMeals = {};
  for (let r = 0; r < rows; r++) {
    const meal = isMealHeader(at(r, 0));
    if (!meal) continue;
    const rest = grid[r]!.slice(1).map(clean).filter(Boolean).join(", ");
    if (rest) fallback[meal] = rest;
  }
  const score = Object.keys(fallback).length;
  if (score >= 2) return { days: {}, fallback, score };
  return null;
}

export function parseLines(lines: string[]): ParsedMenu | null {
  const days: Menu["days"] = {};
  const fallback: DayMeals = {};
  let day: Weekday | null = null;
  let meal: MealKey | null = null;

  const add = (m: MealKey, value: string): void => {
    if (day === null) {
      const v = clean(value);
      if (v === "") return;
      fallback[m] = fallback[m] ? `${fallback[m]}, ${v}` : v;
    } else {
      put(days, day, m, value);
    }
  };

  for (const raw of lines) {
    const line = clean(raw);
    if (line === "") continue;

    const d = isDayHeader(line);
    if (d !== null && matchMeal(line) === null) {
      day = d;
      meal = null;
      continue;
    }

    const m = matchMeal(line);
    if (m !== null) {
      meal = m;
      const rest = line.replace(/^[^:\-–—]*[:\-–—]?\s*/, "");
      const headingOnly = isMealHeader(line) !== null && !/[:\-–—]/.test(line);
      if (!headingOnly && rest !== "" && matchMeal(rest) === null) add(m, rest);
      continue;
    }

    if (meal !== null) add(meal, line);
  }

  const score = countMeals(days, fallback);
  if (score < 2) return null;
  const hasFallback = Object.keys(fallback).length > 0;
  return { days, ...(hasFallback ? { fallback } : {}), score };
}

function gridFromTable(table: Element): string[][] {
  const grid: string[][] = [];
  for (const tr of table.querySelectorAll("tr")) {
    // skip rows of nested tables so their cells are not double counted
    if (tr.closest("table") !== table) continue;
    const row: string[] = [];
    for (const cell of tr.children) {
      if (cell.tagName !== "TD" && cell.tagName !== "TH") continue;
      const span = Math.min(Number(cell.getAttribute("colspan") ?? 1) || 1, 12);
      const text = textOf(cell);
      for (let i = 0; i < span; i++) row.push(text);
    }
    if (row.length > 0) grid.push(row);
  }
  return grid;
}

const BLOCK = new Set(["P", "DIV", "LI", "UL", "OL", "BR", "H1", "H2", "H3", "H4", "H5", "H6", "TR", "TABLE", "SECTION", "ARTICLE", "DT", "DD", "TD", "TH"]);

export function linesOf(node: Node): string[] {
  const out: string[] = [];
  let current = "";
  const flush = (): void => {
    const t = clean(current);
    if (t !== "") out.push(t);
    current = "";
  };
  const walk = (n: Node): void => {
    if (n.nodeType === 3) {
      current += n.textContent ?? "";
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG"].includes(el.tagName.toUpperCase())) return;
    const block = BLOCK.has(el.tagName.toUpperCase());
    if (block) flush();
    for (const child of el.childNodes) walk(child);
    if (block) flush();
  };
  walk(node);
  flush();
  return out;
}

function textOf(el: Element): string {
  return clean(linesOf(el).join(" "));
}

export function parseElement(el: Element): ParsedMenu | null {
  const tables = el.tagName === "TABLE" ? [el] : [...el.querySelectorAll("table")];
  let best: ParsedMenu | null = null;
  for (const table of tables) {
    const parsed = parseGrid(gridFromTable(table));
    if (parsed && (!best || parsed.score > best.score)) best = parsed;
  }
  if (best) return best;
  return parseLines(linesOf(el));
}

export function autoDetect(doc: Document): ParsedMenu | null {
  let best: ParsedMenu | null = null;
  for (const table of doc.querySelectorAll("table")) {
    const parsed = parseGrid(gridFromTable(table));
    if (parsed && (!best || parsed.score > best.score)) best = parsed;
  }
  if (best) return best;
  if (!doc.body) return null;
  return parseLines(linesOf(doc.body));
}

export function readMenu(doc: Document, selector: string | null): ParsedMenu | null {
  if (selector) {
    let el: Element | null = null;
    try {
      el = doc.querySelector(selector);
    } catch {
      el = null;
    }
    if (el) {
      const parsed = parseElement(el);
      if (parsed) return parsed;
    }
  }
  return autoDetect(doc);
}

export function toMenu(parsed: ParsedMenu, now: number): Menu {
  return {
    days: parsed.days,
    ...(parsed.fallback ? { fallback: parsed.fallback } : {}),
    fetchedAt: now,
  };
}