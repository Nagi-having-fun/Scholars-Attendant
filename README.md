# Scholars-Attendant (Paper Collector)

An [OpenClaw](https://github.com/openclaw/openclaw) plugin that automatically detects research paper URLs, extracts structured metadata, and provides a full paper analysis pipeline — from quick saves to richly formatted Notion blog pages.

## Quick Start

```bash
# 1. Clone
git clone https://github.com/Nagi-having-fun/-Scholars-Attendant.git
cd -Scholars-Attendant

# 2. Install (no build step needed — OpenClaw runs TypeScript via jiti)
npm install --omit=dev

# 3. Set your Notion API token
export NOTION_API_TOKEN=ntn_your_token_here

# 4. Register as an OpenClaw plugin
#    Add to your openclaw.json (or via CLI):
openclaw plugin add ./path/to/-Scholars-Attendant

# 5. Create the Notion database (one-time setup)
#    Share a Notion page with your integration first, then:
#    Use the notion_setup tool with parent_page_id=<your_page_id>
```

### Docker Setup

If running OpenClaw via Docker, add to your `docker-compose.yml`:

```yaml
services:
  openclaw:
    environment:
      NOTION_API_TOKEN: ${NOTION_API_TOKEN}
    volumes:
      - ./path/to/-Scholars-Attendant:/app/extensions/paper-collector
```

And in your `.env`:

```bash
NOTION_API_TOKEN=ntn_your_token_here
```

### Standalone Usage (without OpenClaw)

The tools can also be used programmatically:

```typescript
import { createExtractPaperFiguresTool } from "./src/notion-tools.js";

// Extract validated figure URLs from any arXiv paper
const tool = createExtractPaperFiguresTool({ logger: console });
const result = await tool.execute("call-1", { arxiv_id: "2410.08827" });
// Returns only figures ≥10KB, validated via HEAD request
```

## Features

- **Multi-platform URL detection**: Supports arXiv, Xiaohongshu, WeChat, X/Twitter, GitHub, and more
- **Image-based paper inference**: Analyzes images (screenshots, diagrams) to identify papers from social media posts
- **Structured metadata extraction**: Title, authors, institutions (multi-select tags), summary, contributions, tags
- **AlphaXiv integration**: Fetch AI-generated structured overviews for arXiv papers
- **Formula & table parsing**: Extract equations with correct LaTeX formatting and tables with proper structure
- **Figure extraction with validation**: Collect figures from ar5iv → arXiv HTML → PDF screenshots, with ≥10KB size validation to reject fragments
- **Blog-style Notion pages**: Richly formatted pages with KaTeX equations, embedded figures, tables, and references
- **Chinese translation sub-pages**: Full Chinese translation as a child page (same figures, tables, equations)
- **Quality gate enforcement**: Rejects content under 40 blocks or with 0/broken images
- **Progress reporting**: Status messages at each step; never silently fails
- **Batch operations**: `notion_batch_save` for bulk paper import with deduplication and rate limiting

## Skills

The plugin provides 5 AI skills that work together as a paper analysis pipeline:

| Skill | Description |
|-------|-------------|
| **paper-collector** | Core workflow: detect paper URLs, extract metadata, save to Notion. Triggers automatically on URLs. |
| **alphaxiv-lookup** | Fetch structured AI-generated paper overviews from alphaxiv.org. |
| **paper-parse** | Extract formulas, symbols, and tables with correct LaTeX formatting. |
| **paper-figures** | Extract and validate paper figures. Sources: ar5iv, arXiv HTML, PDF browser screenshots, GitHub. |
| **paper-to-notion** | Convert a paper into a blog-style Notion page with full Chinese translation sub-page. |

### Typical Workflow

```
User sends a paper URL (Discord / Telegram / Web)
        │
        ▼
  paper-collector          ← Auto-detect, extract metadata, save to Notion DB
        │
        ▼
  extract_paper_figures    ← Validate figure URLs (≥10KB, reachable)
        │                     Fallback: PDF browser screenshots
        ▼
  notion_write_page        ← English blog page (≥40 blocks, validated images)
        │                     TL;DR, verbatim abstract, method, results, references
        ▼
  notion_create_child_page ← Chinese translation (full mirror, NOT a summary)
        │
        ▼
  Reply to user            ← Title, authors, Notion link, stats
```

## Tools

| Tool | Description |
|------|-------------|
| `notion_save_paper` | Save a paper's structured metadata to the Notion database |
| `notion_batch_save` | Save multiple papers with deduplication and rate limiting |
| `notion_setup` | One-time setup: create the Paper Collection database in Notion |
| `extract_page_images` | Extract image URLs from HTML for visual paper identification |
| `extract_paper_figures` | **Programmatically** extract and validate figure URLs from ar5iv/arXiv HTML (≥10KB, HEAD-checked) |
| `notion_write_page` | Write blog-style content to a Notion page (quality gate: ≥40 blocks, validated images) |
| `notion_create_child_page` | Create a child page (e.g., Chinese translation) with same quality gates |

### Quality Gates

The `notion_write_page` and `notion_create_child_page` tools enforce:

1. **Minimum 40 blocks** — rejects short summaries, requires full paper analysis
2. **Must include images** — rejects 0-image content (unless explicitly declared figureless)
3. **Image URL validation** — HEAD-checks every image URL, rejects 404s and fragments <10KB
4. **Broken image rejection** — ar5iv often splits composite figures into tiny sub-images; these are filtered out

## Notion Database Schema

| Property      | Type         | Description                                    |
|---------------|--------------|------------------------------------------------|
| Title         | Title        | Paper title                                    |
| Authors       | Rich Text    | Comma-separated author names                   |
| Institution   | Multi-select | First author & corresponding author affiliations |
| Published     | Date         | Publication date                               |
| Source URL    | URL          | Original URL shared by user                    |
| Paper URL     | URL          | Direct link to paper (arXiv, DOI)              |
| Summary       | Rich Text    | One-sentence summary                           |
| Contributions | Rich Text    | Main contributions (2-3 sentences)             |
| Tags          | Multi-select | Research area tags                              |
| Conference    | Select       | Venue with year (e.g., NeurIPS 2025)           |
| Status        | Select       | Unread / Reading / Read                        |
| Notes (备注)   | Rich Text    | Personal reading notes                         |

## Project Structure

```
├── index.ts                  # Plugin entry point — registers all 7 tools
├── openclaw.plugin.json      # Plugin manifest with config schema
├── package.json
├── src/
│   ├── config.ts             # Configuration parser (databaseId, parentPageId)
│   ├── types.ts              # TypeScript type definitions
│   ├── notion-client.ts      # Notion API client (CRUD, batch, child pages)
│   ├── notion-tools.ts       # All 7 tool definitions with quality gates
│   ├── markdown-to-blocks.ts # Markdown → Notion block converter
│   └── image-extract.ts      # HTML image URL extraction utilities
└── skills/
    ├── paper-collector/      # Core: URL detection, metadata extraction
    ├── alphaxiv-lookup/      # AlphaXiv structured paper overview
    ├── paper-parse/          # Formula, symbol & table extraction
    ├── paper-figures/        # Figure extraction with multi-source fallback
    └── paper-to-notion/      # Blog-style Notion page generation
```

## Supported Platforms

arXiv, Xiaohongshu (小红书), WeChat (微信公众号), X/Twitter, GitHub, Google Scholar, Semantic Scholar, PapersWithCode, HuggingFace, and academic conference sites (NeurIPS, ICML, ICLR, ACL, CVPR, AAAI, etc.)

## Requirements

- Node.js 22+ or Bun
- [OpenClaw](https://github.com/openclaw/openclaw) (for plugin mode)
- A Notion integration token ([create one here](https://www.notion.so/my-integrations))

## License

MIT
