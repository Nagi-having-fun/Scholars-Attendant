---
name: paper-figures
description: Extract and save figures/images from research papers. Retrieves paper figures with captions and saves them for use in Notion pages or other outputs. Use when the user wants to collect, view, or save figures from a paper.
---

# Paper Figures — Extract & Save Paper Images

Extract figures, diagrams, and visual content from research papers and save them for downstream use (Notion blog pages, presentations, notes).

## When to Use

- User asks to see or save figures from a paper
- Before running `paper-to-notion` to collect figures for the blog page
- User wants to understand a paper's architecture/method diagram
- User asks about a specific figure in a paper

## Workflow

### Step 1: Identify figure sources

For arXiv papers, figures are typically available from multiple sources:

**Source A — arXiv HTML version** (best quality, individual images):
```
https://arxiv.org/html/{PAPER_ID}
```
Use `web_fetch` to get the HTML page. Extract `<img>` tags — arXiv HTML embeds individual figure images with URLs like:
```
https://arxiv.org/html/{PAPER_ID}/extracted/figures/figure1.png
```

**Source B — Paper PDF via browser** (universal fallback):
1. Use `browser` to navigate to `https://arxiv.org/pdf/{PAPER_ID}`
2. Screenshot pages containing figures
3. Each screenshot captures the figure with its caption

**Source C — AlphaXiv** (pre-extracted):
```
https://alphaxiv.org/abs/{PAPER_ID}.md
```
May contain figure references and descriptions.

**Source D — Semantic Scholar / Papers With Code**:
Some papers have extracted figures on these platforms. Use `web_search` for `"{paper title}" figures site:paperswithcode.com`.

**Source E — GitHub repository** (often has high-quality figures):
Many papers have official code repos with figures in a `figures/` or `assets/` directory. Check:
1. Use `web_search` for `"{paper title}" github` or look for GitHub links on the arXiv abstract page
2. Fetch the repo's README with `web_fetch` — figures are usually embedded there
3. Figure URLs follow the pattern: `https://github.com/{org}/{repo}/raw/main/figures/{name}.png`
4. This source is especially useful when arXiv HTML is unavailable (papers before ~2023 or very new papers where HTML hasn't been generated yet)

**Source priority order**: arXiv HTML → GitHub repo → PDF browser screenshots → Semantic Scholar/PapersWithCode

### Step 2: Extract figures with metadata

For each figure, collect:

- **Figure number**: Fig. 1, Fig. 2, etc.
- **Image URL**: Direct link to the image file
- **Caption**: The full caption text below the figure
- **Type**: architecture diagram / results plot / comparison table / example / other

### Step 3: Save figures

**Option A — Report to user** (default):
List all figures with their URLs, captions, and thumbnails. The user can choose which to save.

**Option B — Upload to Notion** (when used with paper-to-notion):
Provide the figure URLs to the `paper-to-notion` skill for embedding in the Notion page. Notion supports external image URLs directly:
```
![Fig. 1: Caption text](https://arxiv.org/html/PAPER_ID/extracted/figures/figure1.png)
```

**Option C — Save to workspace** (when local storage is available):
Use `exec` to download figures to the workspace:
```bash
mkdir -p /workspace/papers/{PAPER_ID}/figures
curl -sL "IMAGE_URL" -o /workspace/papers/{PAPER_ID}/figures/fig1.png
```

### Step 4: Present results

Format the output as:

```
## Figures from "{Paper Title}"

### Figure 1 — [Brief description]
![Fig. 1](image_url)
> **Caption**: [Full caption text]

### Figure 2 — [Brief description]
![Fig. 2](image_url)
> **Caption**: [Full caption text]
```

## arXiv HTML Figure Extraction Tips

The arXiv HTML version (`/html/` endpoint) is the best source for individual figure images:

1. Fetch `https://arxiv.org/html/{PAPER_ID}` with `web_fetch`
2. Look for `<figure>` elements or `<img>` tags with `src` attributes
3. Figure images typically live at paths like:
   - `https://arxiv.org/html/{PAPER_ID}/extracted/figures/*.png`
   - `https://arxiv.org/html/{PAPER_ID}/x*.png`
4. Captions are in `<figcaption>` elements or adjacent `<p>` tags

If the HTML version is not available (older papers), fall back to Source B (browser screenshots).

## Notes

- Always prefer arXiv HTML (`/html/`) over PDF screenshots for image quality
- Some figures span multiple sub-figures (a, b, c) — extract the full composite image
- For tables that are rendered as images in the PDF, use `paper-parse` instead to get proper text tables
- When saving to Notion, use the direct image URL — Notion will cache it automatically
- Not all arXiv papers have an HTML version; papers before ~2023 often only have PDF
