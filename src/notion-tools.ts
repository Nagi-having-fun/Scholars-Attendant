import type { PaperCollectorConfig, PaperMetadata } from "./types.js";
import {
  createDatabase,
  findBySourceUrl,
  savePaperToNotion,
  batchSavePapers,
  clearPageContent,
  appendBlocks,
  createChildPage,
} from "./notion-client.js";
import { extractImagesFromHtml } from "./image-extract.js";
import { markdownToBlocks } from "./markdown-to-blocks.js";

/**
 * Validate image URLs: reachable (HEAD) and not tiny fragments (< 10KB).
 * arXiv HTML splits composite figures into sub-images (legends, sub-panels)
 * that are often < 5KB and display as tiny strips in Notion.
 */
const MIN_IMAGE_BYTES = 10_000; // 10KB — real figures are typically 20KB+

async function validateImageUrls(
  blocks: Array<Record<string, unknown>>,
): Promise<{
  broken: Array<{ url: string; status: number | string }>;
  tooSmall: Array<{ url: string; bytes: number }>;
}> {
  const imageBlocks = blocks.filter((b) => b.type === "image");
  const broken: Array<{ url: string; status: number | string }> = [];
  const tooSmall: Array<{ url: string; bytes: number }> = [];

  await Promise.all(
    imageBlocks.map(async (block) => {
      const img = block.image as Record<string, unknown> | undefined;
      const ext = img?.external as Record<string, unknown> | undefined;
      const url = ext?.url as string | undefined;
      if (!url) return;

      try {
        const resp = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) {
          broken.push({ url, status: resp.status });
          return;
        }
        const contentLength = Number(resp.headers.get("content-length") || 0);
        if (contentLength > 0 && contentLength < MIN_IMAGE_BYTES) {
          tooSmall.push({ url, bytes: contentLength });
        }
      } catch (err) {
        broken.push({
          url,
          status: err instanceof Error ? err.message : "fetch failed",
        });
      }
    }),
  );

  return { broken, tooSmall };
}

const NotionSavePaperSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["title", "authors", "source_url", "summary", "contributions", "tags"],
  properties: {
    title: { type: "string" as const, description: "Paper title." },
    authors: { type: "string" as const, description: "Comma-separated author names." },
    institutions: {
      type: "array" as const,
      items: { type: "string" as const },
      description:
        "Institution tags for first author and corresponding author (e.g., [\"MIT\", \"Stanford\"]). Use short, standard names.",
    },
    published_date: {
      type: "string" as const,
      description: "Publication date in ISO 8601 format (YYYY-MM-DD).",
    },
    source_url: { type: "string" as const, description: "Original URL the user shared." },
    paper_url: { type: "string" as const, description: "Direct paper link (arXiv, DOI, etc.)." },
    summary: { type: "string" as const, description: "One-sentence summary of the paper." },
    contributions: {
      type: "string" as const,
      description: "Main contributions of the paper (2-3 sentences).",
    },
    tags: {
      type: "array" as const,
      items: { type: "string" as const },
      description:
        "Mid-level research area tags. Do NOT include: broad tags (LLM, NLP, deep learning), " +
        "paper-specific names (TOFU, SimNPO, FLAT), or conference names (use 'conference' field instead).",
    },
    conference: {
      type: "string" as const,
      description:
        "Conference or journal venue with year, e.g., 'NeurIPS 2025', 'ICLR 2026', 'ICML 2024', 'ACL 2025'. " +
        "Leave empty if not published at a venue yet.",
    },
    status: {
      type: "string" as const,
      enum: ["Unread", "Reading", "Read"],
      description: "Reading status. Default: Unread.",
    },
    notes: {
      type: "string" as const,
      description:
        "Personal reading notes or relevance context (e.g., 'Must read — directly motivates our QRR probe'). " +
        "Stored in the 备注 column.",
    },
    database_id: {
      type: "string" as const,
      description: "Override database ID (uses config default if omitted).",
    },
  },
};

const NotionSetupSchema = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    parent_page_id: {
      type: "string" as const,
      description:
        "Notion page ID under which to create the database. Uses config default if omitted.",
    },
  },
};

export function createNotionSavePaperTool(params: {
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
    name: "notion_save_paper",
    label: "Save Paper to Notion",
    description:
      "Save a research paper's structured metadata to the Notion paper collection database. " +
      "Use this after extracting paper information from a URL via web_fetch.",
    parameters: NotionSavePaperSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      if (!notionToken) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: NOTION_API_TOKEN not configured. Ask the owner to set up Notion integration.",
            },
          ],
        };
      }

      const dbId =
        (typeof rawParams.database_id === "string" && rawParams.database_id) ||
        config.databaseId;
      if (!dbId) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: No database ID configured. Run the notion_setup tool first, or set databaseId in plugin config.",
            },
          ],
        };
      }

      const sourceUrl = rawParams.source_url as string;

      // Check for duplicates
      try {
        const exists = await findBySourceUrl({
          token: notionToken,
          databaseId: dbId,
          sourceUrl,
        });
        if (exists) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Paper already exists in database for URL: ${sourceUrl}`,
              },
            ],
          };
        }
      } catch (err) {
        logger.warn(`Duplicate check failed: ${String(err)}`);
      }

      const paper: PaperMetadata = {
        title: rawParams.title as string,
        authors: rawParams.authors as string,
        institutions: Array.isArray(rawParams.institutions) ? rawParams.institutions.map(String) : [],
        publishedDate: (rawParams.published_date as string) ?? "",
        sourceUrl,
        paperUrl: (rawParams.paper_url as string) ?? "",
        summary: rawParams.summary as string,
        contributions: rawParams.contributions as string,
        tags: Array.isArray(rawParams.tags) ? rawParams.tags.map(String) : [],
        conference: (rawParams.conference as string) ?? "",
        status: ((rawParams.status as string) ?? "Unread") as PaperMetadata["status"],
        notes: (rawParams.notes as string) ?? "",
      };

      try {
        const result = await savePaperToNotion({
          token: notionToken,
          databaseId: dbId,
          paper,
        });

        logger.info(`Saved paper "${paper.title}" to Notion: ${result.pageId}`);

        return {
          content: [
            {
              type: "text" as const,
              text: `Paper saved to Notion.\nTitle: ${paper.title}\nNotion page: ${result.url}`,
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to save paper: ${msg}`);
        return {
          content: [
            { type: "text" as const, text: `Failed to save paper to Notion: ${msg}` },
          ],
        };
      }
    },
  };
}

// --- Batch save tool ---

const NotionBatchSaveSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["papers"],
  properties: {
    papers: {
      type: "array" as const,
      description:
        "Array of paper objects to save. Each paper has the same fields as notion_save_paper. " +
        "Duplicates (by source_url) are automatically skipped.",
      items: {
        type: "object" as const,
        additionalProperties: false,
        required: ["title", "authors", "source_url", "summary", "tags"],
        properties: {
          title: { type: "string" as const, description: "Paper title." },
          authors: { type: "string" as const, description: "Comma-separated author names." },
          institutions: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "Institution abbreviations (e.g., ['MIT', 'Stanford']).",
          },
          published_date: {
            type: "string" as const,
            description: "Publication date YYYY-MM-DD.",
          },
          source_url: { type: "string" as const, description: "Original URL (arXiv, DOI, etc.)." },
          paper_url: { type: "string" as const, description: "Direct paper link." },
          summary: { type: "string" as const, description: "One-sentence summary." },
          contributions: { type: "string" as const, description: "Main contributions (2-3 sentences)." },
          tags: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "Mid-level research area tags.",
          },
          conference: { type: "string" as const, description: "Venue with year (e.g., 'ICLR 2025')." },
          status: {
            type: "string" as const,
            enum: ["Unread", "Reading", "Read"],
            description: "Reading status. Default: Unread.",
          },
          notes: {
            type: "string" as const,
            description: "Personal reading notes or relevance context.",
          },
        },
      },
    },
    database_id: {
      type: "string" as const,
      description: "Override database ID (uses config default if omitted).",
    },
  },
};

export function createNotionBatchSaveTool(params: {
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
    name: "notion_batch_save",
    label: "Batch Save Papers to Notion",
    description:
      "Save multiple research papers to the Notion database in one call. " +
      "Automatically deduplicates by source_url and rate-limits API calls. " +
      "Use this when adding a reading list, survey papers, or multiple references at once.",
    parameters: NotionBatchSaveSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      if (!notionToken) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: NOTION_API_TOKEN not configured.",
            },
          ],
        };
      }

      const dbId =
        (typeof rawParams.database_id === "string" && rawParams.database_id) ||
        config.databaseId;
      if (!dbId) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: No database ID configured. Run notion_setup first.",
            },
          ],
        };
      }

      const rawPapers = rawParams.papers;
      if (!Array.isArray(rawPapers) || rawPapers.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "Error: papers array is empty or invalid." },
          ],
        };
      }

      // Map raw params to PaperMetadata
      const papers: PaperMetadata[] = rawPapers.map((p: Record<string, unknown>) => ({
        title: (p.title as string) ?? "",
        authors: (p.authors as string) ?? "",
        institutions: Array.isArray(p.institutions) ? p.institutions.map(String) : [],
        publishedDate: (p.published_date as string) ?? "",
        sourceUrl: (p.source_url as string) ?? "",
        paperUrl: (p.paper_url as string) ?? "",
        summary: (p.summary as string) ?? "",
        contributions: (p.contributions as string) ?? "",
        tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
        conference: (p.conference as string) ?? "",
        status: ((p.status as string) ?? "Unread") as PaperMetadata["status"],
        notes: (p.notes as string) ?? "",
      }));

      logger.info(`Batch saving ${papers.length} papers to Notion...`);

      try {
        const result = await batchSavePapers({
          token: notionToken,
          databaseId: dbId,
          papers,
        });

        // Build summary
        const lines: string[] = [
          `Batch save complete: ${result.succeeded} saved, ${result.skipped} duplicates skipped, ${result.failed} failed.`,
          "",
        ];

        for (const r of result.results) {
          const icon = r.status === "saved" ? "+" : r.status === "duplicate" ? "=" : "x";
          const detail = r.url ? ` → ${r.url}` : r.error ? ` — ${r.error}` : "";
          lines.push(`[${icon}] ${r.title}${detail}`);
        }

        logger.info(
          `Batch save: ${result.succeeded}/${result.total} saved, ${result.skipped} skipped, ${result.failed} failed`,
        );

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Batch save failed: ${msg}`);
        return {
          content: [
            { type: "text" as const, text: `Batch save failed: ${msg}` },
          ],
        };
      }
    },
  };
}

export function createNotionSetupTool(params: {
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
    name: "notion_setup",
    label: "Setup Notion Database",
    description:
      "Create the Paper Collection database in Notion under a specified parent page. " +
      "One-time setup tool. Returns the database ID to save in config.",
    parameters: NotionSetupSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      if (!notionToken) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                "Error: NOTION_API_TOKEN not configured.\n\n" +
                "Setup instructions:\n" +
                "1. Go to https://www.notion.so/my-integrations\n" +
                "2. Create a new internal integration\n" +
                "3. Copy the Internal Integration Secret\n" +
                "4. Add NOTION_API_TOKEN to your docker-compose environment\n" +
                "5. Share the parent Notion page with your integration\n" +
                "6. Restart the gateway",
            },
          ],
        };
      }

      const parentPageId =
        (typeof rawParams.parent_page_id === "string" && rawParams.parent_page_id) ||
        config.parentPageId;
      if (!parentPageId) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                "Error: No parent page ID provided.\n\n" +
                "To find your Notion page ID:\n" +
                "1. Open the Notion page where you want the database\n" +
                "2. Click Share > Copy link\n" +
                "3. The page ID is the 32-character hex string in the URL\n" +
                "   Example: https://notion.so/My-Page-abc123def456...\n" +
                "4. Pass it as parent_page_id parameter.",
            },
          ],
        };
      }

      try {
        const result = await createDatabase({
          token: notionToken,
          parentPageId,
        });

        logger.info(`Created Notion database: ${result.databaseId}`);

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Notion database created successfully.\n` +
                `Database ID: ${result.databaseId}\n\n` +
                `Save this ID in your openclaw.json config under:\n` +
                `plugins.entries.paper-collector.config.databaseId`,
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to create database: ${msg}`);
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Failed to create Notion database: ${msg}\n\n` +
                "Make sure:\n" +
                "1. The integration has access to the parent page (Share > Invite)\n" +
                "2. The parent page ID is correct\n" +
                "3. The integration token is valid",
            },
          ],
        };
      }
    },
  };
}

// --- Image extraction tool ---

const ExtractPageImagesSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["html"],
  properties: {
    html: {
      type: "string" as const,
      description:
        "Raw HTML content from web_fetch. The tool extracts image URLs from it.",
    },
    base_url: {
      type: "string" as const,
      description: "Base URL for resolving relative image paths.",
    },
    limit: {
      type: "number" as const,
      description: "Max images to return (default 10).",
    },
  },
};

export function createExtractPageImagesTool(params: {
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}) {
  const { logger } = params;

  return {
    name: "extract_page_images",
    label: "Extract Images from Page",
    description:
      "Extract image URLs (og:image, img src, data-src) from HTML returned by web_fetch. " +
      "Use this when a page lacks paper title/link in text but may contain paper " +
      "figures, architecture diagrams, or screenshots that can identify the paper. " +
      "Returns image URLs that you can then view with web_fetch or browser to " +
      "visually identify the paper.",
    parameters: ExtractPageImagesSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const html = rawParams.html as string;
      if (!html || html.length < 10) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: No HTML content provided or content is too short.",
            },
          ],
        };
      }

      const limit =
        typeof rawParams.limit === "number" ? rawParams.limit : undefined;
      const baseUrl =
        typeof rawParams.base_url === "string" ? rawParams.base_url : undefined;

      const images = extractImagesFromHtml(html, { limit, baseUrl });

      if (images.length === 0) {
        logger.info("No content images found in HTML");
        return {
          content: [
            {
              type: "text" as const,
              text:
                "No content images found in the HTML. " +
                "Try using the browser tool to take screenshots of the page instead.",
            },
          ],
        };
      }

      logger.info(`Extracted ${images.length} images from HTML`);

      const lines = images.map((img, i) => {
        const parts = [`[${i + 1}] ${img.url}`, `    source: ${img.source}`];
        if (img.alt) parts.push(`    alt: ${img.alt}`);
        return parts.join("\n");
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Found ${images.length} image(s):\n\n${lines.join("\n\n")}\n\n` +
              "Next steps:\n" +
              "1. Use web_fetch on the image URLs to view them (especially og:image and the first few content images)\n" +
              "2. Look for: paper titles, author names, arXiv IDs, architecture diagrams, figure captions, method names\n" +
              "3. Use any identified keywords to web_search for the paper",
          },
        ],
      };
    },
  };
}

// --- Page content writing tools ---

const NotionWritePageSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["page_id", "markdown"],
  properties: {
    page_id: {
      type: "string" as const,
      description:
        "Notion page ID to write content to (the 32-char hex ID from the page URL).",
    },
    markdown: {
      type: "string" as const,
      description:
        "Page content in Notion-flavored Markdown. Supports: headings (#/##/###), " +
        "bold (**), italic (*), inline math ($...$), block equations ($$...$$), " +
        "images (![caption](url)), tables (<table>), callouts (<callout>), " +
        "bulleted/numbered lists, dividers (---), and <table_of_contents/>.",
    },
    clear_existing: {
      type: "boolean" as const,
      description: "If true, clear existing page content before writing. Default: true.",
    },
  },
};

export function createNotionWritePageTool(params: {
  notionToken: string;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}) {
  const { notionToken, logger } = params;

  return {
    name: "notion_write_page",
    label: "Write Page Content to Notion",
    description:
      "Write a blog-style paper summary (headings, equations, figures, tables) to a Notion page. " +
      "IMPORTANT: This tool REJECTS content shorter than 40 blocks. " +
      "You MUST include: VERBATIM abstract, VERBATIM introduction, detailed method with equations, " +
      "complete experiment tables (ALL rows/columns), figures, and ALL references. " +
      "Tables can use markdown pipe syntax (| col1 | col2 |) or HTML <table> syntax.",
    parameters: NotionWritePageSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      if (!notionToken) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: NOTION_API_TOKEN not configured.",
            },
          ],
        };
      }

      const pageId = rawParams.page_id as string;
      const markdown = rawParams.markdown as string;
      const clearExisting = rawParams.clear_existing !== false; // default true

      try {
        // Convert markdown to blocks first (for validation)
        const blocks = markdownToBlocks(markdown);

        // Quality gate: count blocks and images
        const imageCount = blocks.filter(
          (b: Record<string, unknown>) => b.type === "image",
        ).length;
        const MIN_BLOCKS = 40;

        if (blocks.length < MIN_BLOCKS) {
          logger.warn(
            `Quality gate: rejected ${blocks.length} blocks (min ${MIN_BLOCKS}) for page ${pageId}`,
          );
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `REJECTED: Content too short (${blocks.length} blocks, minimum ${MIN_BLOCKS}). ` +
                  `A proper blog-style summary needs verbatim abstract, full introduction, detailed method, complete experiment tables, and all references.\n\n` +
                  `Before calling this tool again, you MUST:\n` +
                  `1. web_fetch https://alphaxiv.org/overview/{PAPER_ID}.md — structured overview\n` +
                  `2. web_fetch https://alphaxiv.org/abs/{PAPER_ID}.md — complete table data (every row/column) and full text\n` +
                  `3. Search for figures: try arXiv HTML, GitHub repo (many papers have figures/ dir), or browser screenshots\n` +
                  `4. Compose 3000-8000 words with: TL;DR, VERBATIM Abstract, VERBATIM Introduction, Background, Method (equations + figures), Experiments (complete data tables), Discussion, Key Takeaways, ALL References\n\n` +
                  `Current content has ${imageCount} images. Aim for 3-5 figures from the paper.`,
              },
            ],
          };
        }

        // Warn (but allow) content with 0 images — some papers have no extractable figures online
        if (imageCount === 0) {
          logger.warn(
            `Quality gate: 0 images for page ${pageId} (${blocks.length} blocks) — allowing but warning`,
          );
        }

        // Validate image URLs — reject if broken or tiny fragments
        const { broken: brokenImages, tooSmall } = await validateImageUrls(blocks);
        if (brokenImages.length > 0) {
          const brokenList = brokenImages
            .map((b) => `  - ${b.url} → ${b.status}`)
            .join("\n");
          logger.warn(
            `Quality gate: ${brokenImages.length} broken image URL(s) for page ${pageId}:\n${brokenList}`,
          );
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `REJECTED: ${brokenImages.length} image URL(s) are broken (404 or unreachable):\n${brokenList}\n\n` +
                  `DO NOT guess or fabricate image URLs. You must verify each URL exists before using it.\n\n` +
                  `How to find REAL figure URLs:\n` +
                  `1. Use browser to screenshot the PDF pages that contain figures (PREFERRED)\n` +
                  `2. web_fetch the arXiv HTML page and extract ACTUAL <img> src attributes\n` +
                  `3. web_fetch the GitHub repo README and extract ACTUAL image URLs\n` +
                  `4. If no real URLs exist, submit content without those figures\n\n` +
                  `Fix the broken URLs or remove them, then call this tool again.`,
              },
            ],
          };
        }
        if (tooSmall.length > 0) {
          const smallList = tooSmall
            .map((s) => `  - ${s.url} → ${s.bytes} bytes`)
            .join("\n");
          logger.warn(
            `Quality gate: ${tooSmall.length} tiny image(s) for page ${pageId}:\n${smallList}`,
          );
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `REJECTED: ${tooSmall.length} image(s) are too small (< 10KB) and are likely arXiv HTML sub-image fragments, not complete figures:\n${smallList}\n\n` +
                  `arXiv HTML often splits composite figures into tiny sub-images (legends, sub-panels) that display as broken strips in Notion.\n\n` +
                  `Instead, use the browser tool to screenshot figures directly from the PDF:\n` +
                  `  browser action=navigate url="https://arxiv.org/pdf/{PAPER_ID}"\n` +
                  `  browser action=screenshot (capture each page with figures)\n\n` +
                  `Remove the tiny fragment URLs and replace them with browser screenshots or full-size images, then call this tool again.`,
              },
            ],
          };
        }

        // Clear existing content if requested
        if (clearExisting) {
          await clearPageContent({ token: notionToken, pageId });
        }

        // Append blocks to page
        await appendBlocks({ token: notionToken, pageId, blocks });

        logger.info(`Wrote ${blocks.length} blocks to page ${pageId}`);

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully wrote ${blocks.length} content blocks to Notion page.\nPage: https://www.notion.so/${pageId.replace(/-/g, "")}`,
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to write page content: ${msg}`);
        return {
          content: [
            { type: "text" as const, text: `Failed to write page content: ${msg}` },
          ],
        };
      }
    },
  };
}

const NotionCreateChildPageSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["parent_page_id", "title", "markdown"],
  properties: {
    parent_page_id: {
      type: "string" as const,
      description: "Parent Notion page ID under which to create the child page.",
    },
    title: {
      type: "string" as const,
      description: "Title of the child page.",
    },
    icon: {
      type: "string" as const,
      description: "Emoji icon for the page (e.g., '🇨🇳'). Optional.",
    },
    markdown: {
      type: "string" as const,
      description:
        "Page content in Notion-flavored Markdown (same format as notion_write_page).",
    },
  },
};

export function createNotionCreateChildPageTool(params: {
  notionToken: string;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}) {
  const { notionToken, logger } = params;

  return {
    name: "notion_create_child_page",
    label: "Create Child Page in Notion",
    description:
      "Create a Chinese translation sub-page under a Notion page. " +
      "IMPORTANT: This tool REJECTS content shorter than 40 blocks. " +
      "The Chinese page must be a FULL translation of the English page — same figures, tables, equations, " +
      "VERBATIM translated abstract and introduction, and ALL references. NOT a short summary.",
    parameters: NotionCreateChildPageSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      if (!notionToken) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: NOTION_API_TOKEN not configured.",
            },
          ],
        };
      }

      const parentPageId = rawParams.parent_page_id as string;
      const title = rawParams.title as string;
      const icon = rawParams.icon as string | undefined;
      const markdown = rawParams.markdown as string;

      try {
        // Convert markdown to blocks first (for validation)
        const blocks = markdownToBlocks(markdown);

        // Quality gate: same minimum as notion_write_page
        const imageCount = blocks.filter(
          (b: Record<string, unknown>) => b.type === "image",
        ).length;
        const MIN_BLOCKS = 40;

        if (blocks.length < MIN_BLOCKS) {
          logger.warn(
            `Quality gate: rejected child page "${title}" with ${blocks.length} blocks (min ${MIN_BLOCKS})`,
          );
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `REJECTED: Content too short (${blocks.length} blocks, minimum ${MIN_BLOCKS}). ` +
                  `The Chinese sub-page must be a FULL translation of the English page — ` +
                  `same sections, same figures (${imageCount} images found), same tables, same equations. ` +
                  `Abstract and Introduction must be translated VERBATIM (word-for-word). ` +
                  `All references must be preserved. ` +
                  `Take the English markdown and translate every paragraph to Chinese while keeping ` +
                  `all formatting, image URLs, table data, and equations intact.`,
              },
            ],
          };
        }

        // Warn (but allow) child page with 0 images
        if (imageCount === 0) {
          logger.warn(
            `Quality gate: 0 images for child page "${title}" (${blocks.length} blocks) — allowing but warning`,
          );
        }

        // Validate image URLs — reject if broken or tiny fragments
        const { broken: brokenImages, tooSmall } = await validateImageUrls(blocks);
        if (brokenImages.length > 0) {
          const brokenList = brokenImages
            .map((b) => `  - ${b.url} → ${b.status}`)
            .join("\n");
          logger.warn(
            `Quality gate: ${brokenImages.length} broken image URL(s) for child page "${title}":\n${brokenList}`,
          );
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `REJECTED: ${brokenImages.length} image URL(s) are broken:\n${brokenList}\n\n` +
                  `Use the same verified image URLs from the English page.\n` +
                  `Fix or remove the broken URLs, then call this tool again.`,
              },
            ],
          };
        }
        if (tooSmall.length > 0) {
          const smallList = tooSmall
            .map((s) => `  - ${s.url} → ${s.bytes} bytes`)
            .join("\n");
          logger.warn(
            `Quality gate: ${tooSmall.length} tiny image(s) for child page "${title}":\n${smallList}`,
          );
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `REJECTED: ${tooSmall.length} image(s) are too small (< 10KB) — likely arXiv HTML fragments:\n${smallList}\n\n` +
                  `Use the same full-size image URLs from the English page, or browser PDF screenshots.\n` +
                  `Remove tiny fragments and call this tool again.`,
              },
            ],
          };
        }

        // Create the child page
        const page = await createChildPage({
          token: notionToken,
          parentPageId,
          title,
          icon,
        });

        // Append content
        if (blocks.length > 0) {
          await appendBlocks({ token: notionToken, pageId: page.pageId, blocks });
        }

        logger.info(
          `Created child page "${title}" (${blocks.length} blocks) under ${parentPageId}`,
        );

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Child page created successfully.\n` +
                `Title: ${title}\n` +
                `Blocks: ${blocks.length}\n` +
                `URL: ${page.url}`,
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to create child page: ${msg}`);
        return {
          content: [
            { type: "text" as const, text: `Failed to create child page: ${msg}` },
          ],
        };
      }
    },
  };
}
