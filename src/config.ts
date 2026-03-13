import type { PaperCollectorConfig } from "./types.js";

const DEFAULTS: PaperCollectorConfig = {
  databaseId: "",
  parentPageId: "",
};

export function parseConfig(raw?: Record<string, unknown>): PaperCollectorConfig {
  if (!raw) return { ...DEFAULTS };
  return {
    databaseId: typeof raw.databaseId === "string" ? raw.databaseId : DEFAULTS.databaseId,
    parentPageId:
      typeof raw.parentPageId === "string" ? raw.parentPageId : DEFAULTS.parentPageId,
  };
}
