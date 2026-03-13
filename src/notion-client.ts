import type { PaperMetadata } from "./types.js";

const NOTION_API_VERSION = "2022-06-28";
const NOTION_BASE_URL = "https://api.notion.com/v1";

function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_API_VERSION,
  };
}

function truncate(s: string, max = 2000): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

/** Create the Paper Collection database under a parent page. */
export async function createDatabase(params: {
  token: string;
  parentPageId: string;
}): Promise<{ databaseId: string }> {
  const { token, parentPageId } = params;

  const body = {
    parent: { type: "page_id" as const, page_id: parentPageId },
    title: [{ type: "text" as const, text: { content: "Paper Collection" } }],
    properties: {
      Title: { title: {} },
      Authors: { rich_text: {} },
      Institution: { rich_text: {} },
      Published: { date: {} },
      "Source URL": { url: {} },
      "Paper URL": { url: {} },
      Summary: { rich_text: {} },
      Contributions: { rich_text: {} },
      Tags: { multi_select: {} },
      Status: {
        select: {
          options: [
            { name: "Unread", color: "gray" },
            { name: "Reading", color: "yellow" },
            { name: "Read", color: "green" },
          ],
        },
      },
    },
  };

  const response = await fetch(`${NOTION_BASE_URL}/databases`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Notion API error ${response.status}: ${errorBody.slice(0, 500)}`);
  }

  const data = (await response.json()) as { id: string };
  return { databaseId: data.id };
}

/** Save a paper entry to the Notion database. */
export async function savePaperToNotion(params: {
  token: string;
  databaseId: string;
  paper: PaperMetadata;
}): Promise<{ pageId: string; url: string }> {
  const { token, databaseId, paper } = params;

  const properties: Record<string, unknown> = {
    Title: {
      title: [{ type: "text", text: { content: truncate(paper.title, 500) } }],
    },
    Authors: {
      rich_text: [{ type: "text", text: { content: truncate(paper.authors) } }],
    },
    Institution: {
      rich_text: [{ type: "text", text: { content: truncate(paper.institution) } }],
    },
    "Source URL": { url: paper.sourceUrl || null },
    "Paper URL": { url: paper.paperUrl || null },
    Summary: {
      rich_text: [{ type: "text", text: { content: truncate(paper.summary) } }],
    },
    Contributions: {
      rich_text: [{ type: "text", text: { content: truncate(paper.contributions) } }],
    },
    Tags: {
      multi_select: paper.tags.slice(0, 10).map((t) => ({ name: t.slice(0, 100) })),
    },
    Status: { select: { name: paper.status } },
  };

  if (paper.publishedDate) {
    properties.Published = { date: { start: paper.publishedDate } };
  }

  const body = { parent: { database_id: databaseId }, properties };

  const response = await fetch(`${NOTION_BASE_URL}/pages`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Notion API error ${response.status}: ${errorBody.slice(0, 500)}`);
  }

  const data = (await response.json()) as { id: string; url: string };
  return { pageId: data.id, url: data.url };
}

/** Check for duplicate source URLs in the database. */
export async function findBySourceUrl(params: {
  token: string;
  databaseId: string;
  sourceUrl: string;
}): Promise<boolean> {
  const { token, databaseId, sourceUrl } = params;

  const body = {
    filter: { property: "Source URL", url: { equals: sourceUrl } },
    page_size: 1,
  };

  const response = await fetch(`${NOTION_BASE_URL}/databases/${databaseId}/query`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(body),
  });

  if (!response.ok) return false;
  const data = (await response.json()) as { results: unknown[] };
  return data.results.length > 0;
}
