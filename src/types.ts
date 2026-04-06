/** Supported AI model providers and their models. */
export const AVAILABLE_MODELS = {
  anthropic: [
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
  ],
  openai: [
    "gpt-5.4",
    "gpt-4.1",
    "gpt-4.1-mini",
    "o3",
    "o4-mini",
  ],
  google: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ],
  deepseek: [
    "deepseek-chat",
    "deepseek-reasoner",
  ],
} as const;

export type ModelProvider = keyof typeof AVAILABLE_MODELS;
export type ModelId = (typeof AVAILABLE_MODELS)[ModelProvider][number];

export type PaperCollectorConfig = {
  databaseId: string;
  parentPageId: string;
  /** AI model for generating summaries in API mode (e.g., "claude-sonnet-4-6"). */
  model: string;
  /** Whether to include figures in blog pages (default: true). */
  includeImages: boolean;
  /** Execution mode: "api" uses AI API directly, "agent" relies on hosting LLM agent. */
  mode: "api" | "agent";
};

export type PaperMetadata = {
  title: string;
  authors: string;
  institutions: string[];
  publishedDate: string;
  sourceUrl: string;
  paperUrl: string;
  summary: string;
  contributions: string;
  tags: string[];
  conference: string;
  status: "Unread" | "Reading" | "Read";
  notes: string;
};

export type BatchSaveResult = {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: Array<{
    title: string;
    status: "saved" | "duplicate" | "failed";
    pageId?: string;
    url?: string;
    error?: string;
  }>;
};
