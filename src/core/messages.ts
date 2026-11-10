import type { ParsedMenu } from "./parse";

export type ToBackground =
  | { type: "setSource"; url: string; html: string; selector: string | null }
  | { type: "refresh" };

export interface ScanResult {
  ok: boolean;
  meals: number;
  error?: string;
}

export interface ToOffscreen {
  target: "offscreen";
  type: "parse";
  html: string;
  selector: string | null;
}

export interface ParseReply {
  parsed: ParsedMenu | null;
}