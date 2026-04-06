import fs from "node:fs";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { parseConfig } from "./src/config.js";
import {
  createNotionSavePaperTool,
  createNotionBatchSaveTool,
  createNotionSetupTool,
  createExtractPageImagesTool,
  createExtractPaperFiguresTool,
  createNotionWritePageTool,
  createNotionCreateChildPageTool,
} from "./src/notion-tools.js";
import { createGenerateSummaryTool } from "./src/api-mode-tools.js";

function resolveNotionToken(): string {
  const keyFile = process.env.NOTION_API_TOKEN_FILE;
  if (keyFile) {
    try {
      return fs.readFileSync(keyFile, "utf8").trim();
    } catch {}
  }
  return process.env.NOTION_API_TOKEN ?? "";
}

const plugin = {
  id: "paper-collector",
  name: "Paper Collector",
  description: "Auto-detect research/paper URLs and save structured metadata to Notion.",

  register(api: OpenClawPluginApi) {
    const config = parseConfig(api.pluginConfig);
    const logger = api.logger;
    const notionToken = resolveNotionToken();

    if (!notionToken) {
      logger.warn(
        "NOTION_API_TOKEN not set — paper-collector tools will fail at runtime",
      );
    }

    // Core tools — always registered (both API mode and agent mode)
    api.registerTool(createNotionSavePaperTool({ config, notionToken, logger }));
    api.registerTool(createNotionBatchSaveTool({ config, notionToken, logger }));
    api.registerTool(createNotionSetupTool({ config, notionToken, logger }));
    api.registerTool(createExtractPageImagesTool({ logger }));
    api.registerTool(createExtractPaperFiguresTool({ logger }));
    api.registerTool(createNotionWritePageTool({ config, notionToken, logger }));
    api.registerTool(createNotionCreateChildPageTool({ config, notionToken, logger }));

    // API mode: register the auto-generate tool that calls AI APIs directly
    if (config.mode === "api") {
      api.registerTool(createGenerateSummaryTool({ config, notionToken, logger }));
      logger.info(
        `Paper collector [API mode]: model=${config.model}, images=${config.includeImages}`,
      );
    } else {
      logger.info(
        `Paper collector [agent mode]: tools registered, agent handles generation`,
      );
    }

    logger.info(
      `Paper collector active: databaseId=${config.databaseId || "(not set)"}, mode=${config.mode}`,
    );
  },
};

export default plugin;
