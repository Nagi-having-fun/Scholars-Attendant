---
name: paper-collector
description: "MUST USE when the user sends any URL (arXiv, Xiaohongshu, WeChat, X/Twitter, GitHub, blog, etc.). Fetches content, detects if research/paper-related, extracts metadata, and saves to Notion via notion_save_paper. Always read this skill before responding to messages containing URLs."
---

# Paper Collector

When a user sends a message containing a URL, evaluate whether the content is research or paper-related. If it is, extract structured metadata and save it to Notion using the `notion_save_paper` tool.

## URL Detection

Activate this workflow when the user's message contains a URL from any source, including but not limited to:

- **arXiv** (`arxiv.org`)
- **Xiaohongshu** (`xiaohongshu.com`, `xhslink.com`)
- **WeChat articles** (`mp.weixin.qq.com`)
- **X / Twitter** (`x.com`, `twitter.com`)
- **GitHub** (`github.com`)
- **Academic blogs**
- **Conference sites**: NeurIPS, ICML, ICLR, ACL, CVPR, AAAI, etc.
- **Google Scholar**, **Semantic Scholar**, **PapersWithCode**, **HuggingFace**
- Any other URL that might contain or reference a research paper

Do NOT activate for clearly non-research URLs (e.g., shopping pages, entertainment, social media posts unrelated to research).

## Important: Tool Usage Rules

- **ALWAYS** use `web_fetch` to retrieve URL content. NEVER use `exec`, `bash`, `curl`, `wget`, or `python` to download URLs.
- **ALWAYS** use `web_search` for searching. NEVER use `exec` to run search commands.
- These rules exist because `exec` calls trigger security review and will be blocked. `web_fetch` and `web_search` are built-in safe tools that work directly.

## Workflow

For ALL links — regardless of source — follow the same multi-step extraction process.

### Step 1: Fetch and assess content

Use `web_fetch` to retrieve the page content from the URL. NEVER use exec/curl/wget — always use the built-in `web_fetch` tool. Then assess:

- **Sufficient text**: The page returned paper title, authors, abstract, or a clear discussion of a specific paper → proceed to Step 2.
- **Insufficient text / blocked / login page / anti-scraping**: The page returned very little text, an error, a login wall, or content appears to be in images → **you MUST go to Step 1b**. Do NOT give up. Do NOT ask the user to paste content.

This applies to ALL platforms. Many platforms (Xiaohongshu, WeChat, X) will block `web_fetch`. This is expected — always fall back to the `browser` tool.

### Step 1b: Visual extraction (MANDATORY when text is insufficient)

**CRITICAL: You MUST use the `browser` tool when `web_fetch` fails or returns insufficient content. NEVER tell the user you "can't access" a URL — use the browser instead.**

When `web_fetch` did not return enough useful content:

1. Use the `browser` tool to navigate to the URL: `browser action=navigate url="<the URL>"`
2. Take a screenshot: `browser action=screenshot`
3. Read the screenshot to extract any paper-related information:
   - Paper title (look for both English and Chinese titles)
   - Author names
   - arXiv ID or DOI
   - Key findings, contributions, or methodology
4. If the page has more content below the fold, scroll and take additional screenshots: `browser action=scroll_down` then `browser action=screenshot`
5. Combine information from text (Step 1) and screenshots (Step 1b).
6. If the browser also fails, use `web_search` with any keywords from the URL (domain, path segments, query params) to find the paper.

### Step 2: Evaluate relevance

From whatever content you gathered (text + visual), determine if this is about a specific research paper. Look for:
- Paper title, author names, abstract
- arXiv IDs (e.g., `2301.12345`)
- DOI references
- Conference/journal names
- Technical methodology descriptions

If NOT research-related: respond normally. Do not use `notion_save_paper`.

### Step 3: Find the original paper

**Always** try to find the actual paper, regardless of the source type:

1. **If arXiv ID found** (e.g., `2301.12345`): construct `https://arxiv.org/abs/2301.12345`
2. **If paper title found** but no direct link: use `web_search` to search for:
   - `"<exact paper title>" arxiv` (try this first)
   - `"<exact paper title>" paper pdf`
   - `<paper title> <first author last name>`
3. **If only partial info** (e.g., topic keywords, author name, but no exact title): use `web_search` with those keywords to identify the paper.
4. **From search results**, find the arXiv, Semantic Scholar, or official paper page.
5. **Fetch the paper page**: use `web_fetch` on the found paper URL to get accurate metadata (authors, date, abstract).

### Step 4: Extract metadata

Combine information from the original source AND the paper's actual page:

- **title**: The paper's actual English title
- **authors**: Author names from the paper page, comma-separated
- **institution**: Primary institution(s) if identifiable
- **published_date**: In YYYY-MM-DD format if available
- **source_url**: The original URL the user sent
- **paper_url**: Direct link to the paper itself (arXiv abs page, DOI URL, etc.)
- **summary**: One-sentence summary of what the paper does
- **contributions**: 2-3 sentences on main contributions
- **tags**: English research area tags (e.g., "LLM", "diffusion model", "reinforcement learning", "computer vision", "NLP", "robotics")

### Step 5: Save to Notion

Call `notion_save_paper` with the extracted metadata.

### Step 6: Reply to user

Brief confirmation with the paper title, authors, one-line summary, and Notion link.

## Language Handling

- Extract the **original English paper title** whenever possible
- Write summary and contributions in the same language the user uses
- Tags should always be in English (standardized)

## Edge Cases

- **Multiple papers in one URL**: Extract the primary paper discussed
- **Duplicate URL**: The tool checks and will inform you if already saved
- **Uncertain if research**: Ask the user before saving
- **Paywalled/limited content**: Extract what you can and note incompleteness
- **Social media threads**: Use the main post URL as source_url
- **Browser not available**: Work with whatever text `web_fetch` returned and use `web_search` to find the paper by any keywords you can identify
- **Cannot find original paper**: Save with whatever metadata you have; leave paper_url empty and note in summary that the original paper could not be located
