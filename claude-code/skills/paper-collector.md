---
name: paper-collector
description: "Use when the user sends any URL that may reference a research paper. Detects paper info, saves metadata to Notion, then generates English + Chinese blog-style Notion pages with figures."
---

# Paper Collector (Claude Code Adaptation)

## Tool Mapping

Claude Code does NOT have OpenClaw's custom tools. Use these native equivalents:

| OpenClaw Tool | Claude Code Equivalent |
|---|---|
| `web_fetch` | `WebFetch` tool |
| `web_search` | `WebSearch` or Exa `web_search_exa` |
| `browser` (screenshots) | Not available — use `curl` via Bash for HTML, or Exa `crawling_exa` |
| `extract_page_images` | `WebFetch` + parse HTML, or `curl` + extract `<img>` tags |
| `notion_save_paper` | `notion-create-pages` with `data_source_id` |
| `notion_write_page` | `notion-update-page` with `replace_content` command |
| `notion_create_child_page` | `notion-create-pages` with parent `page_id`, then `notion-update-page` |

## Critical Formatting Rules

1. **Use REAL newlines in Notion content** — never use `\n` escape sequences. The Notion MCP tool renders `\n` as literal text.
2. **Always fetch ALL figures** from `https://arxiv.org/html/{PAPER_ID}v{VERSION}/` and verify each URL returns HTTP 200 and >10KB.
3. **Follow the OpenClaw page format**: `# Title` → `<table_of_contents/>` → metadata → TL;DR → Abstract → numbered sections → figures → references.
4. **Multi-select properties** (Institution, Tags) accept only single values per API call — use existing options or add new ones via `notion-update-data-source` first.

## Workflow

### Step 1: Fetch & Identify Paper

1. Try `WebFetch` on the URL
2. If blocked (Xiaohongshu, WeChat, etc.):
   - Try alternate URL formats (e.g., `/explore/` for XHS instead of `/discovery/item/`)
   - Use `curl` via Bash with mobile User-Agent
   - Extract title from `<title>` tag or `<meta>` tags in the HTML
3. Search for the paper on arXiv: `web_search_exa` with the extracted title
4. Fetch arXiv page for accurate metadata

### Step 2: Extract Metadata

From the arXiv page, extract:
- **title**: English paper title
- **authors**: Full names, comma-separated
- **institutions**: Short abbreviations (MIT, CMU, Stanford, etc.) — first + corresponding author only
- **published_date**: YYYY-MM-DD
- **source_url**: Original URL user sent
- **paper_url**: arXiv link
- **summary**: One sentence
- **contributions**: 2-3 sentences
- **tags**: Mid-level research areas (use existing Notion DB options)
- **conference**: Venue with year (optional)

### Step 3: Save to Notion

```
notion-create-pages with:
  parent: { type: "data_source_id", data_source_id: "<YOUR_DATA_SOURCE_ID>" }
  pages: [{ properties: { Title, Authors, Institution, ... }, icon: "📄" }]
```

**Important:** Check existing multi-select options first. If Institution/Tags values don't exist, add them via `notion-update-data-source` before creating the page.

### Step 4: Fetch Figures

1. Fetch `https://arxiv.org/html/{PAPER_ID}v{VERSION}/` via WebFetch
2. Extract all `<img>` src attributes
3. Construct full URLs: `https://arxiv.org/html/{PAPER_ID}v{VERSION}/{relative_path}`
4. Verify each with `curl -sL -o /dev/null -w "%{http_code} %{size_download}"` — reject <10KB
5. Also check: `extracted/*/figures/*.png`, `extracted/*/figures/*.jpeg`

### Step 5: Fetch Paper Content

In parallel:
- `WebFetch` on `https://alphaxiv.org/overview/{PAPER_ID}.md` (structured overview)
- `WebFetch` on `https://alphaxiv.org/abs/{PAPER_ID}.md` (full text with tables)
- ArXiv abstract page for verbatim abstract

### Step 6: Write English Blog Page

Use `notion-update-page` with `replace_content` command:

```
page_id: <from Step 3>
command: "replace_content"
new_str: <markdown content with REAL newlines>
```

**Page structure** (follow exactly):
```markdown
# Paper Title

<table_of_contents color="gray"/>

---

**Authors:** ...
**Institutions:** ...
**Conference:** ...
**arXiv:** https://arxiv.org/abs/...

---

## TL;DR
...

---

## Abstract
(VERBATIM from paper)

---

## 1 Introduction
...
![Figure 1: Caption](https://arxiv.org/html/.../x1.png)

## 2 Method
...

## 3 Results
| Column | Column |
|---|---|
| data | data |

## 4 Key Takeaways
- ...

---

## References
1. [Author et al. (Year). Title](url). *Venue*.
```

### Step 7: Create Chinese Translation Subpage

1. Create empty child page:
   ```
   notion-create-pages with parent: { type: "page_id", page_id: <english_page_id> }
   icon: "🇨🇳"
   ```
2. Write content via `notion-update-page` with `replace_content`
3. **Full translation** — same sections, figures, tables, equations. NOT a summary.
4. Keep unchanged: image URLs, LaTeX equations, table data, reference URLs

### Step 8: Reply to User

Report:
- Paper title and authors
- One-line summary
- Notion link
- Stats: blocks, figures
- Any errors encountered

## Notion Database Reference

- **Database ID:** (set per user)
- **Data Source ID:** (set per user — get from `notion-fetch` on the database URL)

## Error Handling

- If XHS/WeChat blocked: try alternate URL formats, curl with mobile UA, extract from `<title>` tag
- If AlphaXiv 404: use arXiv HTML + abstract page directly
- If figure URL <10KB: skip (likely arXiv HTML fragment)
- If Notion multi-select fails: add new option via `notion-update-data-source` first, then retry
- If `replace_content` would delete child pages: set `allow_deleting_content: true`
- Never silently fail — always report what happened
