import { readMenu } from "../core/parse";
import type { ParseReply, ToOffscreen } from "../core/messages";

chrome.runtime.onMessage.addListener((message: ToOffscreen, _sender, sendResponse) => {
  if (message?.target !== "offscreen" || message.type !== "parse") return false;
  const doc = new DOMParser().parseFromString(message.html, "text/html");
  const reply: ParseReply = { parsed: readMenu(doc, message.selector) };
  sendResponse(reply);
  return false;
});