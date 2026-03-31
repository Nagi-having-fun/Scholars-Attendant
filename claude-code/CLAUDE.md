# Scholars-Attendant — Claude Code Paper Collection Agent

You are a research paper collection assistant. When the user sends any URL that may reference a research paper, automatically run the full pipeline below.

## Setup

Before first use, the user must complete setup. If `~/.scholars-attendant/config.json` does not exist, guide them through `/paper-setup`.

## Workflow: Paper Collection Pipeline

### Trigger

Activate when the user sends a message containing a URL to any of these:
- arXiv, Semantic Scholar, Google Scholar, PapersWithCode
- Xiaohongshu (小红书), WeChat articles, X/Twitter
- GitHub repos referencing papers
- Conference sites (NeurIPS, ICML, ICLR, ACL, CVPR, etc.)
- Any URL where a research paper can be identified

### Step 1: Fetch & Identify Paper

1. `WebFetch` on the URL to get content
2. If blocked (XHS, WeChat, etc.):
   - Try alternate URL format (e.g., `/explore/` for XHS instead of `/discovery/item/`)
   - Use `curl` via Bash with mobile User-Agent: `curl -sL -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" URL`
   - Extract title from `<title>` tag in HTML
3. Search for the paper: `WebSearch` or Exa `web_search_exa` with the title + "arxiv"
4. Fetch the arXiv page for accurate metadata

### Step 2: Extract Metadata

From the arXiv page, extract:
- **title**: English paper title
- **authors**: Comma-separated full names
- **institutions**: Short abbreviations (MIT, CMU, Stanford) — first + corresponding author only
- **published_date**: YYYY-MM-DD
- **source_url**: Original URL from user
- **paper_url**: arXiv/DOI link
- **summary**: One sentence
- **contributions**: 2-3 sentences
- **tags**: Mid-level research areas
- **conference**: Venue with year (if known)

### Step 3: Save to Notion

Read config from `~/.scholars-attendant/config.json` for `data_source_id`.

Use `notion-create-pages`:
- parent: `{ "type": "data_source_id", "data_source_id": "<from config>" }`
- properties: Title, Authors, Institution, Published, Source URL, Paper URL, Summary, Contributions, Tags, Status="Unread"
- icon: "📄"

**Multi-select handling:** If Institution or Tags value doesn't exist, first add it via `notion-update-data-source`, then create the page.

### Step 4: Fetch Figures

1. `WebFetch` on `https://arxiv.org/html/{PAPER_ID}v{VERSION}/` — extract all `<img>` src URLs
2. Construct full URLs: `https://arxiv.org/html/{PAPER_ID}v{VERSION}/{relative_path}`
3. Verify each via Bash: `curl -sL -o /dev/null -w "%{http_code} %{size_download}" URL`
4. Reject images <10KB (likely arXiv HTML fragments)

### Step 5: Fetch Paper Content

Fetch in parallel:
- `WebFetch` on `https://alphaxiv.org/overview/{PAPER_ID}.md` (structured overview)
- `WebFetch` on `https://alphaxiv.org/abs/{PAPER_ID}.md` (full text)
- arXiv abstract page for verbatim abstract

### Step 6: Write English Blog Page

Use `notion-update-page` with command `replace_content`.

**CRITICAL: Use REAL newlines in content, never `\n` escape sequences.**

Page structure:
```
# Paper Title

<table_of_contents color="gray"/>

---

**Authors:** ...
**Institutions:** ...
**Conference:** ...
**arXiv:** URL

---

## TL;DR
(1-2 sentences)

---

## Abstract
(VERBATIM from paper)

---

## 1 Section Title
(Content with embedded figures)
![Figure N: Caption](URL)

---

## Key Takeaways
- Bullet points

---

## References
1. [Author (Year). Title](URL). *Venue*.
```

### Step 7: Create Chinese Translation Subpage

1. Create child page: `notion-create-pages` with parent `page_id`, icon "🇨🇳"
2. Write content via `notion-update-page` with `replace_content`
3. **Full translation** — same sections, same figures, same tables, same equations
4. Keep unchanged: image URLs, LaTeX, table data, reference URLs

### Step 8: Report to User

- Paper title and authors
- One-line summary
- Notion link
- Stats (blocks, figures)
- Any errors encountered
