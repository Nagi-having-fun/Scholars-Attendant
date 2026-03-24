import type { PaperMetadata, BatchSaveResult } from "./types.js";

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
      Institution: { multi_select: {} },
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
      multi_select: paper.institutions.slice(0, 10).map((i) => ({ name: i.slice(0, 100) })),
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

  if (paper.conference) {
    properties.Conference = { select: { name: paper.conference } };
  }

  if (paper.publishedDate) {
    properties.Published = { date: { start: paper.publishedDate } };
  }

  if (paper.notes) {
    properties["备注"] = {
      rich_text: [{ type: "text", text: { content: truncate(paper.notes) } }],
    };
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

/** Batch save multiple papers with rate limiting and dedup. */
export async function batchSavePapers(params: {
  token: string;
  databaseId: string;
  papers: PaperMetadata[];
  delayMs?: number;
}): Promise<BatchSaveResult> {
  const { token, databaseId, papers, delayMs = 350 } = params;
  const result: BatchSaveResult = {
    total: papers.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    results: [],
  };

  for (const paper of papers) {
    // Check for duplicates by source URL
    if (paper.sourceUrl) {
      try {
        const exists = await findBySourceUrl({ token, databaseId, sourceUrl: paper.sourceUrl });
        if (exists) {
          result.skipped++;
          result.results.push({ title: paper.title, status: "duplicate" });
          continue;
        }
      } catch {
        // Dedup check failed — continue with save attempt
      }
    }

    try {
      const saved = await savePaperToNotion({ token, databaseId, paper });
      result.succeeded++;
      result.results.push({
        title: paper.title,
        status: "saved",
        pageId: saved.pageId,
        url: saved.url,
      });
    } catch (err) {
      result.failed++;
      result.results.push({
        title: paper.title,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Rate limit: Notion API allows ~3 req/s
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return result;
}

/** Delete all child blocks of a page (to clear content). */
export async function clearPageContent(params: {
  token: string;
  pageId: string;
}): Promise<void> {
  const { token, pageId } = params;

  // List all children
  let cursor: string | undefined;
  const blockIds: string[] = [];
  do {
    const url = `${NOTION_BASE_URL}/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`;
    const res = await fetch(url, { headers: buildHeaders(token) });
    if (!res.ok) break;
    const data = (await res.json()) as {
      results: { id: string }[];
      has_more: boolean;
      next_cursor: string | null;
    };
    for (const block of data.results) blockIds.push(block.id);
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
  } while (cursor);

  // Delete each block
  for (const id of blockIds) {
    await fetch(`${NOTION_BASE_URL}/blocks/${id}`, {
      method: "DELETE",
      headers: buildHeaders(token),
    });
  }
}

/** Append blocks to a page (handles 100-block API limit). */
export async function appendBlocks(params: {
  token: string;
  pageId: string;
  blocks: Record<string, unknown>[];
}): Promise<void> {
  const { token, pageId, blocks } = params;

  // Notion API limit: 100 blocks per call
  for (let start = 0; start < blocks.length; start += 100) {
    const batch = blocks.slice(start, start + 100);
    const response = await fetch(`${NOTION_BASE_URL}/blocks/${pageId}/children`, {
      method: "PATCH",
      headers: buildHeaders(token),
      body: JSON.stringify({ children: batch }),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Notion append blocks error ${response.status}: ${errorBody.slice(0, 500)}`);
    }
  }
}

/** Create a child page under a parent page. */
export async function createChildPage(params: {
  token: string;
  parentPageId: string;
  title: string;
  icon?: string;
}): Promise<{ pageId: string; url: string }> {
  const { token, parentPageId, title, icon } = params;

  const body: Record<string, unknown> = {
    parent: { type: "page_id", page_id: parentPageId },
    properties: {
      title: [{ type: "text", text: { content: title } }],
    },
  };
  if (icon) {
    body.icon = { type: "emoji", emoji: icon };
  }

  const response = await fetch(`${NOTION_BASE_URL}/pages`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Notion create page error ${response.status}: ${errorBody.slice(0, 500)}`);
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
