import { toMenu } from "../core/parse";
import type { ParseReply, ScanResult, ToBackground, ToOffscreen } from "../core/messages";
import { notificationText, plan } from "../core/schedule";
import { getMenu, getSettings, getSource, setMenu, setSource } from "../core/storage";
import { MEAL_KEYS, type MealKey, type Source } from "../core/types";

const REFRESH_ALARM = "refresh";
const MEAL_PREFIX = "meal:";
const REFRESH_MINUTES = 180;
const STALE_MS = 20 * 60_000;

let offscreenReady: Promise<void> | null = null;

function ensureOffscreen(): Promise<void> {
  offscreenReady ??= chrome.offscreen
    .createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: "Parse the school menu page",
    })
    .catch((error: unknown) => {
      if (!/single offscreen/i.test(String(error))) {
        offscreenReady = null;
        throw error;
      }
    });
  return offscreenReady;
}

async function parseHtml(html: string, selector: string | null): Promise<ParseReply["parsed"]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await ensureOffscreen();
    try {
      const message: ToOffscreen = { target: "offscreen", type: "parse", html, selector };
      const reply = await chrome.runtime.sendMessage<ToOffscreen, ParseReply>(message);
      return reply?.parsed ?? null;
    } catch {
      offscreenReady = null;
    }
  }
  return null;
}

async function reschedule(): Promise<void> {
  const [menu, settings] = await Promise.all([getMenu(), getSettings()]);
  const existing = await chrome.alarms.getAll();
  await Promise.all(existing.filter((alarm) => alarm.name.startsWith(MEAL_PREFIX)).map((alarm) => chrome.alarms.clear(alarm.name)));
  for (const planned of plan(menu, settings, new Date())) {
    await chrome.alarms.create(planned.id, { when: planned.when });
  }
}

async function applyHtml(source: Source, html: string): Promise<ScanResult> {
  const parsed = await parseHtml(html, source.selector);
  if (!parsed) return { ok: false, meals: 0, error: "No menu found on that page" };
  await setSource(source);
  await setMenu(toMenu(parsed, Date.now()));
  await reschedule();
  return { ok: true, meals: parsed.score };
}

async function refresh(): Promise<ScanResult> {
  const source = await getSource();
  if (!source) return { ok: false, meals: 0, error: "No page chosen yet" };
  try {
    const response = await fetch(source.url, { credentials: "include", cache: "no-cache" });
    if (!response.ok) return { ok: false, meals: 0, error: `The page returned ${response.status}` };
    return await applyHtml(source, await response.text());
  } catch {
    return { ok: false, meals: 0, error: "Could not load the page" };
  }
}

async function handle(message: ToBackground): Promise<ScanResult> {
  switch (message.type) {
    case "setSource":
      return applyHtml({ url: message.url, selector: message.selector }, message.html);
    case "refresh":
      return refresh();
  }
}

async function init(): Promise<void> {
  await chrome.alarms.create(REFRESH_ALARM, { delayInMinutes: 1, periodInMinutes: REFRESH_MINUTES });
  await reschedule();
}

chrome.runtime.onInstalled.addListener(() => void init());
chrome.runtime.onStartup.addListener(() => void init());

chrome.runtime.onMessage.addListener((message: ToBackground | ToOffscreen, _sender, sendResponse) => {
  if (!message || "target" in message) return false;
  void handle(message).then(sendResponse);
  return true;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) void reschedule();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    await refresh();
    return;
  }
  if (!alarm.name.startsWith(MEAL_PREFIX)) return;
  if (Date.now() - alarm.scheduledTime > STALE_MS) return;

  const [, date, meal] = alarm.name.split(":");
  if (!date || !MEAL_KEYS.includes(meal as MealKey)) return;

  const [menu, settings] = await Promise.all([getMenu(), getSettings()]);
  if (!settings.notificationsOn) return;
  const text = notificationText(menu, settings, { id: alarm.name, when: alarm.scheduledTime, meal: meal as MealKey, date });
  if (!text) return;

  await chrome.notifications.create(alarm.name, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: text.title,
    message: text.message,
    priority: 1,
  });
  await reschedule();
});