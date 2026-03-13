import type { PaperCollectorConfig, PaperMetadata } from "./types.js";
import { createDatabase, findBySourceUrl, savePaperToNotion } from "./notion-client.js";

const NotionSavePaperSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["title", "authors", "source_url", "summary", "contributions", "tags"],
  properties: {
    title: { type: "string" as const, description: "Paper title." },
    authors: { type: "string" as const, description: "Comma-separated author names." },
    institution: { type: "string" as const, description: "Primary institution/affiliation." },
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
        "Research area tags (e.g., LLM, reinforcement learning, computer vision).",
    },
    status: {
      type: "string" as const,
      enum: ["Unread", "Reading", "Read"],
      description: "Reading status. Default: Unread.",
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
        institution: (rawParams.institution as string) ?? "",
        publishedDate: (rawParams.published_date as string) ?? "",
        sourceUrl,
        paperUrl: (rawParams.paper_url as string) ?? "",
        summary: rawParams.summary as string,
        contributions: rawParams.contributions as string,
        tags: Array.isArray(rawParams.tags) ? rawParams.tags.map(String) : [],
        status: ((rawParams.status as string) ?? "Unread") as PaperMetadata["status"],
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
