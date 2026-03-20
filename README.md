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
User sends a paper URL
        │
        ▼
  paper-collector          ← Auto-detect, extract metadata, save to Notion DB
        │
        ▼ (follow-up actions)
        │
   ┌────┼────────────┬──────────────┐
   ▼    ▼            ▼              ▼
alphaxiv  paper-parse  paper-figures  paper-to-notion
 lookup   (equations    (save figs)   (full blog page
(summary)  & tables)                   in Notion)
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

1. User sends a URL in a message
2. Plugin fetches and evaluates the content via `web_fetch`
3. If text content is insufficient (blocked by anti-scraping, login walls, etc.):
   - Falls back to browser screenshots
   - **Extracts and analyzes page images** (og:image, embedded figures, etc.) to identify paper clues
   - Uses visual clues (paper titles in screenshots, architecture diagrams, figure captions, arXiv IDs) to search for the paper
4. Extracts structured metadata (title, authors, institutions, summary, tags, etc.)
5. Saves to Notion database with duplicate checking
6. Offers follow-up actions: summary, equation extraction, figure saving, or full blog-style Notion page

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
│   ├── notion-client.ts      # Notion API client
│   ├── notion-tools.ts       # Tool definitions (save_paper, setup, extract_images)
│   └── image-extract.ts      # HTML image URL extraction utilities
└── skills/
    ├── paper-collector/      # Core: URL detection, metadata extraction, Notion save
    ├── alphaxiv-lookup/      # AlphaXiv structured paper overview
    ├── paper-parse/          # Formula, symbol & table extraction
    ├── paper-figures/        # Figure extraction & saving
    └── paper-to-notion/      # Blog-style Notion page generation
```

## License

MIT
