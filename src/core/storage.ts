import { DEFAULT_SETTINGS, type Menu, type Settings, type Source } from "./types";

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return {
    ...DEFAULT_SETTINGS,
    ...(settings ?? {}),
    mealTimes: { ...DEFAULT_SETTINGS.mealTimes, ...(settings?.mealTimes ?? {}) },
  };
}

export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}

export async function getSource(): Promise<Source | null> {
  const { source } = await chrome.storage.local.get("source");
  return source ?? null;
}

export async function setSource(source: Source): Promise<void> {
  await chrome.storage.local.set({ source });
}

export async function getMenu(): Promise<Menu | null> {
  const { menu } = await chrome.storage.local.get("menu");
  return menu ?? null;
}

export async function setMenu(menu: Menu): Promise<void> {
  await chrome.storage.local.set({ menu });
}