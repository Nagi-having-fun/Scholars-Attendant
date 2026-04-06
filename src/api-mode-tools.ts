/**
 * API-mode tools: generate paper summaries using AI APIs directly,
 * without relying on the hosting LLM agent.
 * These tools are registered ONLY when config.mode === "api".
 */

import type { PaperCollectorConfig } from "./types.js";
import { AVAILABLE_MODELS } from "./types.js";
import { generatePaperSummary } from "./ai-client.js";
import { extractImagesFromHtml } from "./image-extract.js";
import { markdownToBlocks } from "./markdown-to-blocks.js";
import { clearPageContent, appendBlocks, createChildPage } from "./notion-client.js";

const MIN_IMAGE_BYTES = 10_000;

async function fetchPaperContent(arxivId: string): Promise<string> {
  // Try AlphaXiv first for structured overview
  for (const base of [
    `https://alphaxiv.org/overview/${arxivId}.md`,
    `https://ar5iv.labs.arxiv.org/html/${arxivId}`,
  ]) {
    try {
      const resp = await fetch(base, {
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PaperCollector/1.0)" },
      });
      if (resp.ok) {
        const text = await resp.text();
        if (text.length > 500) return text;
      }
    } catch { /* try next */ }
  }
  throw new Error(`Could not fetch paper content for ${arxivId}`);
}

async function extractValidatedFigures(arxivId: string): Promise<string[]> {
  const sources = [
    { url: `https://ar5iv.labs.arxiv.org/html/${arxivId}`, baseUrl: `https://ar5iv.labs.arxiv.org/html/${arxivId}/` },
    { url: `https://arxiv.org/html/${arxivId}`, baseUrl: `https://arxiv.org/html/${arxivId}/` },
  ];

  const validUrls: string[] = [];
  const seen = new Set<string>();

  for (const src of sources) {
    try {
      const resp = await fetch(src.url, {
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PaperCollector/1.0)" },
      });
      if (!resp.ok) continue;
      const html = await resp.text();
      if (html.length < 500) continue;

      const images = extractImagesFromHtml(html, { limit: 30, baseUrl: src.baseUrl });
      for (const img of images) {
        if (seen.has(img.url) || img.url.includes("ar5iv.png")) continue;
        seen.add(img.url);
        try {
          const head = await fetch(img.url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
          if (!head.ok) continue;
          const cl = Number(head.headers.get("content-length") || 0);
          if (cl > 0 && cl < MIN_IMAGE_BYTES) continue;
          validUrls.push(img.url);
        } catch { /* skip */ }
      }
      if (validUrls.length >= 3) break;
    } catch { /* try next */ }
  }
  return validUrls;
}

const GenerateSummarySchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["page_id", "arxiv_id"],
  properties: {
    page_id: {
      type: "string" as const,
      description: "Notion page ID to write the summary to.",
    },
    arxiv_id: {
      type: "string" as const,
      description: "arXiv paper ID (e.g., '2410.08827').",
    },
    model: {
      type: "string" as const,
      description:
        "AI model to use for generation. Available models:\n" +
        Object.entries(AVAILABLE_MODELS)
          .map(([provider, models]) => `  ${provider}: ${models.join(", ")}`)
          .join("\n") +
        "\nDefaults to config value if omitted.",
    },
    include_images: {
      type: "boolean" as const,
      description: "Whether to include figures in the blog page. Default: true (from config).",
    },
    create_chinese: {
      type: "boolean" as const,
      description: "Whether to also create a Chinese translation sub-page. Default: true.",
    },
  },
};

export function createGenerateSummaryTool(params: {
  config: PaperCollectorConfig;
  notionToken: string;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}) {
  const { config, notionToken, logger } = params;

  return {
    name: "generate_paper_summary",
    label: "Generate Paper Summary (API Mode)",
    description:
      "Automatically generate a blog-style paper summary using AI APIs and write it to Notion. " +
      "This tool fetches the paper content, extracts figures, calls the configured AI model " +
      "to generate a comprehensive summary, and writes everything to Notion — all in one step. " +
      "Use this in API mode instead of manually composing markdown for notion_write_page.\n\n" +
      "Available models:\n" +
      Object.entries(AVAILABLE_MODELS)
        .map(([provider, models]) => `  ${provider}: ${models.join(", ")}`)
        .join("\n"),
    parameters: GenerateSummarySchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      if (!notionToken) {
        return {
          content: [{ type: "text" as const, text: "Error: NOTION_API_TOKEN not configured." }],
        };
      }

      const pageId = rawParams.page_id as string;
      const arxivId = (rawParams.arxiv_id as string).trim();
      const model = (rawParams.model as string) || config.model;
      const includeImages = rawParams.include_images !== undefined
        ? Boolean(rawParams.include_images)
        : config.includeImages;
      const createChinese = rawParams.create_chinese !== false;

      logger.info(`[API mode] Generating summary for ${arxivId} using ${model}, images=${includeImages}`);

      // Step 1: Fetch paper content
      let paperContent: string;
      try {
        paperContent = await fetchPaperContent(arxivId);
        logger.info(`Fetched paper content: ${paperContent.length} chars`);
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to fetch paper content for ${arxivId}: ${err instanceof Error ? err.message : String(err)}`,
          }],
        };
      }

      // Step 2: Extract figures (if enabled)
      let figureUrls: string[] = [];
      if (includeImages) {
        figureUrls = await extractValidatedFigures(arxivId);
        logger.info(`Found ${figureUrls.length} validated figures`);
      }

      // Step 3: Generate English summary via AI API
      let enMarkdown: string;
      try {
        enMarkdown = await generatePaperSummary({
          model,
          paperTitle: `Paper ${arxivId}`,
          paperContent,
          figureUrls,
          includeImages,
          language: "en",
        });
        logger.info(`Generated English summary: ${enMarkdown.length} chars`);
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: `AI API call failed (${model}): ${err instanceof Error ? err.message : String(err)}`,
          }],
        };
      }

      // Step 4: Write English page to Notion
      try {
        const blocks = markdownToBlocks(enMarkdown);
        await clearPageContent({ token: notionToken, pageId });
        await appendBlocks({ token: notionToken, pageId, blocks });
        logger.info(`Wrote ${blocks.length} blocks to English page`);
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to write English page: ${err instanceof Error ? err.message : String(err)}`,
          }],
        };
      }

      // Step 5: Generate and write Chinese sub-page (if enabled)
      let zhPageUrl = "";
      if (createChinese) {
        try {
          const zhMarkdown = await generatePaperSummary({
            model,
            paperTitle: `Paper ${arxivId}`,
            paperContent,
            figureUrls,
            includeImages,
            language: "zh",
          });
          const zhBlocks = markdownToBlocks(zhMarkdown);

          // Extract title from the first heading
          const titleMatch = enMarkdown.match(/^#\s+(.+)/m);
          const paperTitle = titleMatch?.[1] ?? `Paper ${arxivId}`;

          const zhPage = await createChildPage({
            token: notionToken,
            parentPageId: pageId,
            title: paperTitle,
            icon: "🇨🇳",
          });
          await appendBlocks({ token: notionToken, pageId: zhPage.pageId, blocks: zhBlocks });
          zhPageUrl = zhPage.url;
          logger.info(`Created Chinese sub-page: ${zhBlocks.length} blocks`);
        } catch (err) {
          logger.warn(`Chinese sub-page failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const result = [
        `Summary generated successfully using ${model}.`,
        `English page: https://www.notion.so/${pageId.replace(/-/g, "")}`,
        zhPageUrl ? `Chinese page: ${zhPageUrl}` : "Chinese page: skipped or failed",
        `Figures: ${figureUrls.length}`,
        `Include images: ${includeImages}`,
      ].join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    },
  };
}
