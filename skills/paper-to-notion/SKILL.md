---
name: paper-to-notion
description: "Convert a research paper into a blog-style Notion page (Lilian Weng style). notion_write_page REJECTS content under 25 blocks — you MUST first web_fetch AlphaXiv overview + full text (for complete tables), find figures (arXiv HTML / GitHub repo / browser), then compose 2000-5000 words with embedded figures, tables, equations, and references. Also creates a Chinese translation sub-page with identical content."
---

# Paper to Notion — Blog-Style Paper Page

Convert a research paper into a richly formatted Notion page, modeled after Lilian Weng's lilianweng.github.io blog posts. The output includes proper headings, KaTeX equations, embedded figures with captions, and hyperlinked citations.

## When to Use

- User asks to save a paper to Notion with full content (not just metadata)
- User says "write up this paper", "create a Notion page for this paper", "blog-style summary"
- After using `alphaxiv-lookup` or `paper-parse` to gather paper content

## Prerequisites

Before creating the Notion page, gather content using other skills:

1. **`alphaxiv-lookup`** — Get the structured overview (abstract, contributions, methodology)
2. **`paper-parse`** — Extract all equations with correct LaTeX and numbering
3. **`paper-figures`** — Collect figure URLs and captions
4. **`paper-collector`** — Ensure the paper is saved in the Paper Collection database (for metadata)

If any skill is unavailable, fetch the paper directly via `web_fetch` on the arXiv PDF/HTML.

## Target Format (Lilian Weng Blog Style)

The final Notion page should follow this structure:

```
Title: [Paper Title]
Icon: (paper emoji)

---

[Table of Contents]

# TL;DR
[1-2 sentence summary of the paper's key contribution]

# Background
[Context and motivation — what problem does this paper address?]
[Key definitions and notation]

# Method
[Detailed methodology with equations and figures]
[Step-by-step explanation of the approach]

# Experiments
[Experimental setup]
[Results tables and figures]
[Key findings]

# Discussion
[Limitations, ablation studies, interesting observations]

# Key Takeaways
[Bulleted summary of the most important points]

# References
[Numbered reference list with hyperlinks]
```

## Notion Formatting Rules

### Headings
Use `#`, `##`, `###` for section hierarchy. The page title is set via properties, NOT in content.

### Equations

**Inline math**: Use `$...$` for inline equations.
```
The loss function $\mathcal{L}(\theta)$ is minimized via gradient descent.
```

**Display math**: Use `$$...$$` on separate lines for block equations.
```
$$
\mathcal{L}(\theta) = -\mathbb{E}_{(x,y) \sim \mathcal{D}} \left[ \log p_\theta(y \mid x) \right]
$$
```

**Equation numbering**: Notion does not support automatic equation numbering. Add the number manually as bold text before or after the equation:
```
**Equation (1)**
$$
J(\theta) = \mathbb{E}_{\tau \sim \pi_\theta} [R(\tau)]
$$
```

### Figures

Use standard markdown image syntax with caption:
```
![Fig. 1: Overview of the proposed architecture. The model consists of an encoder, a routing module, and multiple expert decoders.](https://arxiv.org/html/PAPER_ID/extracted/figures/figure1.png)
```

For figures that need emphasis, wrap in a callout:
```
<callout icon="figure">
![Fig. 1: Architecture overview](image_url)
</callout>
```

### Tables

Use Notion's table syntax for results tables:
```
<table header-row="true" fit-page-width="true">
	<tr>
		<td>**Method**</td>
		<td>**Accuracy**</td>
		<td>**F1**</td>
	</tr>
	<tr>
		<td>Baseline</td>
		<td>78.3</td>
		<td>76.1</td>
	</tr>
	<tr>
		<td>**Ours**</td>
		<td>**82.7**</td>
		<td>**80.4**</td>
	</tr>
</table>
```

**IMPORTANT — Deduplication rule**: If a table's data is already presented as a **figure image** (e.g., a results comparison chart from the paper's GitHub repo or PDF), do NOT recreate it as a Notion table. Instead, embed the figure with a descriptive caption that includes key numbers. Only use Notion tables for:
- Data NOT already shown in any figure (e.g., ablation studies, cost analysis, hyperparameter sensitivity)
- Small supplementary tables that add context beyond what figures show
- Tables you construct yourself to summarize cross-figure insights

This prevents visual redundancy and keeps the page clean.

### Citations & References

**In-text citations**: Use numbered superscript links pointing to the references section at the bottom:
```
Recent work on reward hacking [^https://arxiv.org/abs/2401.12345] has shown that...
```

Or use inline hyperlinks for author-year style:
```
Recent work by [Ouyang et al. (2022)](https://arxiv.org/abs/2203.02155) has shown that...
```

**Reference list**: At the bottom, create a numbered list with full citations and hyperlinks:
```
# References

1. [Ouyang et al., "Training language models to follow instructions with human feedback," *NeurIPS 2022*](https://arxiv.org/abs/2203.02155)
2. [Christiano et al., "Deep reinforcement learning from human preferences," *NeurIPS 2017*](https://arxiv.org/abs/1706.03741)
```

### Callouts for Key Insights

Use colored callouts to highlight important points:
```
<callout icon="bulb" color="yellow_bg">
	**Key Insight**: The reward model's accuracy degrades as the policy diverges from the training distribution, creating a fundamental tension in RLHF.
</callout>
```

### Code Blocks

For algorithms or pseudocode:
```python
def policy_gradient(policy, env, episodes=1000):
    for ep in range(episodes):
        trajectory = rollout(policy, env)
        loss = -sum(log_prob * reward for log_prob, reward in trajectory)
        loss.backward()
```

### Toggle Sections for Detailed Proofs

Use toggles for lengthy derivations that readers may want to skip:
```
<details>
<summary>**Proof of Theorem 1** (click to expand)</summary>
	Starting from the definition...
	$$
	\nabla_\theta J(\theta) = \mathbb{E}_{\pi_\theta} [\nabla_\theta \log \pi_\theta(a|s) Q^{\pi_\theta}(s,a)]
	$$
	By the chain rule...
</details>
```

## Workflow

### Step 1: Gather all content

**CRITICAL: Do NOT skip this step. Do NOT start writing until you have gathered content from multiple sources.** A single source is never enough for a high-quality blog page.

Follow this concrete fetch sequence:

1. **`web_fetch` on `https://alphaxiv.org/overview/{PAPER_ID}.md`** — Get structured overview (abstract, contributions, methodology, results). This is your blog skeleton.
2. **`web_fetch` on `https://alphaxiv.org/abs/{PAPER_ID}.md`** — Get the **full paper text** including **complete table data** (every row, every column, every number). This is essential — without it your tables will be incomplete or missing.
3. **`web_fetch` on `https://arxiv.org/html/{PAPER_ID}`** — Get individual figure image URLs (look for `<img>` tags with `src` like `/html/{ID}/extracted/figures/*.png`). If 404, proceed to next source.
4. **`web_search` for `"{paper title}" github`** — Find the official repo. Many papers have high-quality figures at `github.com/{org}/{repo}/raw/main/figures/*.png`. Fetch the repo README to find figure URLs.
5. **`web_fetch` on `https://arxiv.org/abs/{PAPER_ID}`** — Get metadata (authors, date, categories) if not already known.
6. **PDF via `browser`** — Fallback for figures when HTML and GitHub are unavailable.

After gathering, you should have:
- [ ] Paper title, authors, date, venue
- [ ] Abstract / TL;DR
- [ ] Section structure (headings)
- [ ] All equations with numbering
- [ ] All figures with direct image URLs and captions (aim for **all** figures in the paper, not just 1-2)
- [ ] All tables with **complete data** — every row, every column, every number (from AlphaXiv full text)
- [ ] Reference list with URLs

**If you don't have figures**: you MUST try at least 3 sources before giving up. Missing figures dramatically reduces page quality.
**If you don't have complete tables**: fetch AlphaXiv full text (`/abs/{ID}.md`). The overview endpoint summarizes tables; only the full text has complete data.

### Step 2: Build the page structure

Organize content into the blog-style sections listed above. Adapt the paper's own structure where appropriate — not every paper fits the exact template.

### Step 3: Format equations

Convert all equations to KaTeX-compatible LaTeX. Common adjustments:
- `\bm{x}` → `\mathbf{x}` (KaTeX doesn't support `bm`)
- `\text{softmax}` → `\mathrm{softmax}`
- `\eqref{eq:1}` → **(Eq. 1)** (KaTeX in Notion doesn't support refs)
- Remove `\nonumber`, `\notag` — Notion doesn't auto-number
- `\begin{align}` → `\begin{aligned}` (KaTeX prefers `aligned` inside `$$`)

### Step 4: Build the reference list

For each citation in the paper:
1. Find the paper on arXiv, Semantic Scholar, or DOI
2. Format as: `[Authors, "Title," *Venue Year*](URL)`
3. If no URL found, include the citation text without a link

### Step 5: Create the English Notion page

Use the `notion_write_page` tool to write the blog-style content into the paper's database entry page. Pass the page ID returned by `notion_save_paper` and the full Markdown content.

```
notion_write_page(page_id="<page_id>", markdown="<full blog content>", clear_existing=true)
```

If the database entry doesn't exist yet, create it first via `notion_save_paper`, then use `notion_write_page` with the returned page ID.

### Step 6: Create the Chinese sub-page

**MANDATORY**: After creating the English page, create a **Chinese translation sub-page** as a child of the main page.

```
notion_create_child_page(
  parent_page_id="<page_id>",
  title="中文摘要 — {Paper Title in Chinese}",
  icon="🇨🇳",
  markdown="<full Chinese blog content>"
)
```

**CRITICAL — this is a FULL TRANSLATION, not a summary.** The Chinese page must be the same length and depth as the English page. Specifically:

**Completeness checklist** (all MUST be present):
- [ ] Same number of sections as English (TL;DR → Background → Method → Experiments → Discussion → Key Takeaways → References)
- [ ] **Every figure** from the English page — same image URLs, captions translated to Chinese
- [ ] **Every table** from the English page — same data, headers translated to Chinese
- [ ] **Every equation** from the English page — LaTeX unchanged, surrounding text translated
- [ ] **Every callout** from the English page — translated content, same icons and colors
- [ ] **Every reference** — keep original English citations, do not translate paper titles
- [ ] Word count: **2000-5000 Chinese characters** (comparable to the English version)

**Common mistake**: generating a short 500-word summary instead of translating the full 3000-word English blog. Do NOT do this. If the English page has 15 sections with 5 figures and 6 tables, the Chinese page must also have 15 sections with 5 figures and 6 tables.

**Translation rules**:
- Section headings: translate (e.g., "Background" → "背景", "Method" → "方法", "Experiments" → "实验", "Key Takeaways" → "关键收获")
- Technical terms: keep English in parentheses on first use (e.g., "倒数排名融合 (Reciprocal Rank Fusion)")
- Figure captions: translate to Chinese
- Table headers: translate to Chinese, data values unchanged
- Equations: keep LaTeX as-is, translate only surrounding prose
- Reference list: keep original English citations verbatim
- Image URLs: **identical** to English version — do not modify or omit any

**How to produce the Chinese page**: Take the English markdown you already wrote in Step 5. Translate every paragraph of prose to Chinese while keeping all markdown formatting, image links, table markup, equations, and callouts intact. This ensures nothing is accidentally dropped.

### Step 7: Verify

After creation, use the `fetch` tool to verify:
- Equations render correctly (no broken KaTeX)
- Images load (URLs are accessible)
- Table formatting is correct
- Links work
- Chinese sub-page exists and is accessible

## Content Guidelines

- **English page**: Always in English, 2000-5000 words
- **Chinese sub-page**: Always in Chinese (with English technical terms preserved), **same length and depth as English** — 2000-5000 Chinese characters. NOT a summary.
- **Both pages must include**: all figures, all data tables, all equations, all callouts. The Chinese page is a mirror of the English page in Chinese.
- **Explain intuition** before showing equations — "The key idea is X. Formally, this is expressed as..."
- **Add your own bridging text** — don't just dump raw paper content; connect sections logically
- **Highlight what's novel** — what makes this paper different from prior work?
- **Include practical implications** — "This means that in practice..."
- **Figures are non-negotiable** — a blog page without figures looks incomplete. Try at least 3 sources (arXiv HTML, GitHub, browser) before concluding no figures are available.
- **Tables must be complete** — include every row and column from the paper, not just top-3 results. Fetch AlphaXiv full text for complete table data.

## Notes

- Notion's KaTeX support covers most standard LaTeX math commands but NOT all. Test complex equations.
- External image URLs in Notion may break if the source removes them. For permanent storage, prefer arXiv HTML figure URLs (stable).
- Very long papers: focus on the most important 60-70% of content. Use toggles for supplementary material.
- If the paper is behind a paywall, work with whatever content is available (abstract, AlphaXiv overview, screenshots).
