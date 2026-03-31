# Scholars-Attendant (Paper Collector)

An [OpenClaw](https://github.com/openclaw/openclaw) plugin that automatically detects research paper URLs, extracts structured metadata, and provides a full paper analysis pipeline — from quick saves to richly formatted Notion blog pages.

## Features

- **Multi-platform URL detection**: Supports arXiv, Xiaohongshu, WeChat, X/Twitter, GitHub, and more
- **Image-based paper inference**: When a page lacks text-based paper info (common on social media), the plugin analyzes images — paper screenshots, architecture diagrams, figure reproductions — to identify and search for the paper
- **Structured metadata extraction**: Title, authors, institutions (multi-select tags), summary, contributions, tags
- **AlphaXiv integration**: Fetch AI-generated structured overviews for arXiv papers — faster and more reliable than reading raw PDFs
- **Formula & table parsing**: Extract equations with correct LaTeX formatting and numbering, plus tables with proper structure
- **Figure extraction**: Collect paper figures with captions from arXiv HTML, PDF screenshots, or other sources
- **Blog-style Notion pages**: Convert papers into richly formatted Notion pages with KaTeX equations, embedded figures, hyperlinked references, and toggle sections — modeled after [Lilian Weng's blog](https://lilianweng.github.io/)
- **Chinese translation sub-pages**: Automatically creates a complete Chinese translation as a child page (same figures, tables, equations — not a summary)
- **Quality gate enforcement**: `notion_write_page` and `notion_create_child_page` reject content under 25 blocks, forcing the agent to gather sufficient content before writing
- **Progress reporting**: Sends status messages at each workflow step; never silently fails; reports detailed errors with fallback actions
- **Notion integration**: Auto-saves to a Notion database with deduplication
- **Multi-language support**: Handles Chinese/English content, always extracts English paper titles

## Skills

The plugin provides 5 AI skills that work together as a paper analysis pipeline:

| Skill | Description |
|-------|-------------|
| **paper-collector** | Core workflow: detect paper URLs, extract metadata, save to Notion. Triggers automatically on URLs. |
| **alphaxiv-lookup** | Fetch structured AI-generated paper overviews from alphaxiv.org. Preferred first step before parsing PDFs. |
| **paper-parse** | Extract formulas, symbols, and tables with correct LaTeX formatting and numbering. Two methods: PDF text extraction and image-based visual parsing. |
| **paper-figures** | Extract and save paper figures with captions. Sources: arXiv HTML, PDF browser screenshots, Semantic Scholar. |
| **paper-to-notion** | Convert a paper into a blog-style Notion page with KaTeX equations, embedded figures, Notion tables, hyperlinked citations, toggle proofs, and callout highlights. |

### Typical Workflow

```
User sends a paper URL (Discord / Telegram / Web)
        │
        ▼
  paper-collector          ← Auto-detect, extract metadata, save to Notion DB
        │                     📄 "Processing paper link..."
        │                     ✅ "Metadata saved. Generating blog summary..."
        ▼
  Gather content           ← AlphaXiv overview + full text + arXiv HTML + GitHub figures
        │                     🔍 "Gathering content from AlphaXiv, arXiv, GitHub..."
        ▼
  notion_write_page        ← English blog page (2000-5000 words, ≥25 blocks required)
        │                     ✅ "English page: 108 blocks, 5 figures"
        ▼
  notion_create_child_page ← Chinese translation (full mirror, NOT a summary)
        │                     ✅ "Chinese page: 102 blocks"
        ▼
  Reply to user            ← Title, authors, Notion link, stats
                              ❌ On failure: detailed error + fallback actions
```

## Supported Platforms

- arXiv
- Xiaohongshu (小红书)
- WeChat articles (微信公众号)
- X / Twitter
- GitHub
- Google Scholar, Semantic Scholar, PapersWithCode, HuggingFace
- Academic conference sites (NeurIPS, ICML, ICLR, ACL, CVPR, AAAI, etc.)
- Any URL containing research paper references

## How It Works

1. User sends a URL in a message (Discord, Telegram, or web UI)
2. Plugin fetches and evaluates the content via `web_fetch`
3. If text content is insufficient (blocked by anti-scraping, login walls, etc.):
   - Falls back to browser screenshots
   - **Extracts and analyzes page images** (og:image, embedded figures, etc.) to identify paper clues
   - Uses visual clues (paper titles in screenshots, architecture diagrams, figure captions, arXiv IDs) to search for the paper
4. Extracts structured metadata (title, authors, institutions, summary, tags, etc.)
5. Saves to Notion database with duplicate checking
6. **Auto-generates blog-style English Notion page** (2000-5000 words) with figures, tables, equations, and references
7. **Auto-generates Chinese translation sub-page** — a full mirror with identical figures, tables, and equations
8. Reports progress at every step; reports failures with detailed reasons and fallback actions

### Image-Based Inference Flow

Many social media posts (Xiaohongshu, WeChat, X) discuss papers primarily through images rather than text. The plugin handles this by:

1. **Extracting images** from HTML via `extract_page_images` tool (parses `og:image`, `<img src>`, `data-src`)
2. **Visually analyzing** each image for paper identifiers:
   - Paper titles visible in screenshots
   - arXiv IDs (e.g., `arXiv:2301.12345`)
   - Architecture/method names in diagrams
   - Author names, conference badges, DOIs
   - Figure captions and table headers
3. **Searching** with extracted clues via `web_search`
4. **Verifying** by fetching the actual paper page for accurate metadata

### Paper-to-Notion Blog Format

The `paper-to-notion` skill creates Notion pages with:

- **Table of Contents** for navigation
- **TL;DR** — one-sentence key contribution
- **Background** — context and motivation with notation
- **Method** — detailed methodology with numbered equations and architecture figures
- **Experiments** — results tables and analysis
- **Key Takeaways** — bulleted summary
- **References** — numbered list with hyperlinks to arXiv/DOI
- **Toggle sections** for lengthy proofs and derivations
- **Callout blocks** for key insights and warnings

## Setup

### 1. Create a Notion Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Create a new internal integration
3. Copy the **Internal Integration Secret**

### 2. Configure Environment

```bash
export NOTION_API_TOKEN=your_token_here
```

Or for Docker deployments, add to your `.env`:

```bash
NOTION_API_TOKEN=ntn_your_token_here
```

### 3. Create the Database

Use the `notion_setup` tool with a `parent_page_id` to create the Paper Collection database in Notion. Make sure to share the parent page with your integration first.

### 4. Install as OpenClaw Plugin

Add this plugin to your OpenClaw configuration and set the `databaseId` in the plugin config.

## Tools

| Tool | Description |
|------|-------------|
| `notion_save_paper` | Save a paper's structured metadata to the Notion database |
| `notion_setup` | One-time setup: create the Paper Collection database in Notion |
| `extract_page_images` | Extract image URLs from HTML for visual paper identification |
| `notion_write_page` | Write blog-style content to a Notion page (quality gate: rejects < 25 blocks) |
| `notion_create_child_page` | Create a child page (e.g., Chinese translation) under an existing page (quality gate: rejects < 25 blocks) |

## Notion Database Schema

| Property      | Type         | Description                                    |
|---------------|--------------|------------------------------------------------|
| Title         | Title        | Paper title                                    |
| Authors       | Rich Text    | Comma-separated author names                   |
| Institution   | Multi-select | First author & corresponding author affiliations (e.g., MIT, Stanford) |
| Published     | Date         | Publication date                               |
| Source URL    | URL          | Original URL shared by user                    |
| Paper URL     | URL          | Direct link to paper (arXiv, DOI)              |
| Summary       | Rich Text    | One-sentence summary                           |
| Contributions | Rich Text    | Main contributions (2-3 sentences)             |
| Tags          | Multi-select | Research area tags (English)                   |
| Status        | Select       | Unread / Reading / Read                        |

## Project Structure

```
├── index.ts                  # Plugin entry point
├── openclaw.plugin.json      # Plugin manifest
├── package.json
├── src/
│   ├── config.ts             # Configuration parser
│   ├── types.ts              # TypeScript type definitions
│   ├── notion-client.ts      # Notion API client (CRUD, batch append, child pages)
│   ├── notion-tools.ts       # Tool definitions (save_paper, setup, extract_images, write_page, create_child_page)
│   ├── markdown-to-blocks.ts # Markdown → Notion block converter (headings, equations, images, tables, callouts)
│   └── image-extract.ts      # HTML image URL extraction utilities
└── skills/
    ├── paper-collector/      # Core: URL detection, metadata extraction, Notion save
    ├── alphaxiv-lookup/      # AlphaXiv structured paper overview
    ├── paper-parse/          # Formula, symbol & table extraction
    ├── paper-figures/        # Figure extraction & saving
    └── paper-to-notion/      # Blog-style Notion page generation
```

## Claude Code Integration

This plugin can also be used with **Claude Code** (Anthropic's CLI for Claude) without OpenClaw. Claude Code uses its native tools (Notion MCP, WebFetch, WebSearch) to replicate the same workflow.

### Quick Start (Claude Code)

1. **Clone this repo and enter the Claude Code directory:**
   ```bash
   git clone https://github.com/Akutagawa1998/Scholars-Attendant.git
   cd Scholars-Attendant/claude-code
   ```

2. **Start Claude Code in this directory:**
   ```bash
   claude
   ```
   Claude Code auto-loads `CLAUDE.md` with the full workflow instructions.

3. **Run first-time setup:**
   ```
   /paper-setup
   ```
   This walks you through connecting Notion, finding/creating the Paper Collection database, and saving your config to `~/.scholars-attendant/config.json`.

4. **Collect a paper:**
   ```
   /paper https://arxiv.org/abs/2310.07127
   ```
   Or just paste any paper URL — Claude will auto-detect and run the full pipeline.

5. **Optional: Discord integration**
   ```bash
   claude --channels plugin:discord@claude-plugins-official
   ```
   Then send paper URLs via Discord and Claude will process them remotely.

### Claude Code Tool Mapping

| OpenClaw Tool | Claude Code Equivalent |
|---|---|
| `web_fetch` | `WebFetch` |
| `web_search` | `WebSearch` / Exa `web_search_exa` |
| `browser` (screenshots) | Not available — use `curl` via Bash + Exa `crawling_exa` |
| `extract_page_images` | `WebFetch` + parse HTML |
| `notion_save_paper` | `notion-create-pages` with `data_source_id` |
| `notion_write_page` | `notion-update-page` with `replace_content` |
| `notion_create_child_page` | `notion-create-pages` (parent `page_id`) + `notion-update-page` |

### Claude Code Skills

The `claude-code/skills/` directory contains adapted skill files:

| Skill | Description |
|---|---|
| `paper-collector.md` | Full pipeline: URL → metadata → Notion → English blog → Chinese translation |
| `alphaxiv-lookup.md` | Fetch structured paper analysis from alphaxiv.org |
| `paper-figures.md` | Extract and verify figure URLs from arXiv HTML |

### Key Differences from OpenClaw

1. **No browser tool** — Claude Code can't take screenshots. For blocked pages (Xiaohongshu, WeChat), it uses alternate URL formats and `curl` with mobile User-Agent headers.
2. **Notion content formatting** — Must use **real newlines** in content strings, never `\n` escape sequences (the Notion MCP renders them literally).
3. **Multi-select properties** — Notion MCP requires exact option matches. New Institution/Tags values must be added via `notion-update-data-source` before use.
4. **Discord integration** — Run Claude Code with `--channels plugin:discord@claude-plugins-official` to receive paper URLs via Discord.

### Example Usage (Discord)

```
User: https://arxiv.org/abs/2310.07127
Bot:  🔍 Fetching paper...
      ✅ Metadata saved. Generating blog summary...
      ✅ English page: 45 blocks, 8 figures
      ✅ Chinese page: 42 blocks
      Notion: https://www.notion.so/...
```

### Project Structure (Claude Code)

```
claude-code/
├── CLAUDE.md                        # Auto-loaded by Claude Code — full workflow instructions
├── .claude/
│   └── commands/
│       ├── paper-setup.md           # /paper-setup — first-time Notion configuration
│       └── paper.md                 # /paper <url> — run full collection pipeline
└── skills/
    ├── paper-collector.md           # Full pipeline reference with tool mapping
    ├── alphaxiv-lookup.md           # AlphaXiv fetching reference
    └── paper-figures.md             # Figure extraction reference
```

## License

MIT
