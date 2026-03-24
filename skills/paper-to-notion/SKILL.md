---
name: paper-to-notion
description: "Convert a research paper into a blog-style Notion page (Lilian Weng style). notion_write_page REJECTS content under 40 blocks — you MUST include VERBATIM abstract, VERBATIM introduction, complete tables (use markdown | pipe | syntax), figures, and ALL references. Compose 3000-8000 words. Also creates a Chinese translation sub-page with identical content and verbatim-translated abstract/introduction."
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

# Abstract
[VERBATIM original abstract — copy word-for-word from the paper, do NOT paraphrase or shorten]

# Introduction
[VERBATIM original introduction — copy the full text from the paper, preserving all paragraphs, citations, and structure. Do NOT summarize or shorten.]

# Background
[Context and motivation — prior work, key definitions, notation]

# Method
[Detailed methodology with equations and figures]
[Step-by-step explanation of the approach]

# Experiments
[Experimental setup]
[Results tables and figures — complete, with ALL rows and columns]
[Key findings]

# Discussion
[Limitations, ablation studies, interesting observations]

# Key Takeaways
[Bulleted summary of the most important points]

# References
[COMPLETE numbered reference list with hyperlinks — include ALL references from the paper, not just the ones you cite in your summary]
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

**PREFERRED: Use standard markdown pipe-style tables** (simpler, less error-prone):
```
| **Method** | **Accuracy** | **F1** |
|------------|-------------|--------|
| Baseline | 78.3 | 76.1 |
| **Ours** | **82.7** | **80.4** |
```

Alternative: HTML-style tables (for complex layouts only):
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

## Progress Reporting

**You MUST send status messages to the user at each major step.** Never go silent.

- After gathering content: "🔍 Gathered {N} sources: {list what you found}."
- After writing English page: "✅ English page: {N} blocks, {M} figures."
- After writing Chinese page: "✅ Chinese page: {N} blocks."
- On failure: "❌ {Step} failed: {reason}. {Fallback action}."
- On quality gate rejection: "⚠️ Content too short ({N} blocks). Gathering more data..."

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

#### Handling quality gate rejection

`notion_write_page` will **REJECT** content with fewer than 25 blocks. If this happens:

1. **Tell the user**: "⚠️ Content too short ({N} blocks). Expanding with more detail..."
2. **Expand the content**:
   - Add more detail to Method section (step-by-step explanations, more equations)
   - Add more detail to Experiments section (describe each table row, explain trends)
   - Add Background section if missing (prior work, motivation)
   - Add Discussion section if missing (limitations, ablations)
   - Ensure you have Key Takeaways (bulleted list of 5-8 points)
   - Ensure you have a full References section
3. **Retry** `notion_write_page` with the expanded content
4. If still rejected after 2 tries, **tell the user** with the specific block count and what content is available

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

**CRITICAL — this is a FULL TRANSLATION at Keshav's two-pass depth, not a summary.** After reading only the Chinese page, a reader must be able to summarize the paper's approach, results, and contributions with supporting evidence to someone else — without ever opening the original paper.

**Completeness checklist** (all MUST be present):
- [ ] Same number of sections as English (TL;DR → 背景 → 方法 → 实验 → 讨论 → 关键收获 → 参考文献)
- [ ] **Every figure** from the English page — same image URLs, captions translated to Chinese and explaining what the figure shows
- [ ] **Every table** from the English page — same data, headers translated to Chinese, complete rows (not top-3)
- [ ] **Every equation** from the English page — LaTeX unchanged, surrounding text translated with intuitive explanation of what each term means
- [ ] **Every callout** from the English page — translated content, same icons and colors
- [ ] **Every reference** — keep original English citations, do not translate paper titles
- [ ] Word count: **2000-5000 Chinese characters** (comparable to the English version)
- [ ] **Method section**: step-by-step explanation, not a one-liner — reader should understand how the method works
- [ ] **Experiments section**: specific numbers, comparisons, trends — reader should know the key results
- [ ] **Background section**: 2-3 paragraphs of context — what came before, what gap this paper fills

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

## Content Depth Standard: Keshav's "Two-Pass" Reading Level

The Chinese summary page (and the English page it mirrors) must provide **at least Keshav's second-pass reading depth** (ref: S. Keshav, "How to Read a Paper", ACM SIGCOMM). This means:

> After reading the Chinese summary, the reader should be able to **summarize the main thrust of the paper, with supporting evidence, to someone else**.

Concretely, the reader must be able to answer ALL of these after reading only your summary:

1. **What problem does the paper solve?** — Clear statement of the research gap and motivation
2. **What is the paper's main approach/method?** — Step-by-step explanation with key equations, not just a one-liner
3. **What are the key results?** — Specific numbers, comparisons, and trends from experiments (with complete data tables, not cherry-picked rows)
4. **What do the figures and diagrams show?** — Every major figure must be embedded with a caption that explains what it demonstrates; the reader should understand figures without opening the original paper
5. **How does this relate to prior work?** — Positioning against baselines and related methods
6. **What are the limitations and open questions?** — Honest assessment, not just hype
7. **What are the main contributions?** — Concrete list (not vague claims)

### What "second-pass depth" looks like in practice:

- **Abstract**: VERBATIM — copy the original abstract word-for-word. Do NOT paraphrase, shorten, or summarize. The Chinese page translates it fully.
- **Introduction**: VERBATIM — copy the original introduction in full, preserving all paragraphs, citations, and logical flow. The Chinese page translates it fully.
- **Method section**: Not "they use a transformer." Instead: "They propose X, which works by (1)..., (2)..., (3)... The key equation is $...$ where each term means..." Include architecture diagrams.
- **Experiments section**: Not "they achieve SOTA." Instead: "On benchmark X, the method scores Y (vs. Z for the baseline), a N% improvement. Table 1 shows..." Include the full results table with ALL rows and columns.
- **Figures**: Not a page without images. Instead: every key figure (architecture, results plots, ablation charts) embedded with a translated caption explaining what the reader should notice.
- **References**: COMPLETE — include ALL references from the paper as a numbered list with hyperlinks, not just the ones cited in your summary.

### Minimum content requirements:

- **English page**: 3000-8000 words, ≥40 blocks, ≥3 figures. Must include verbatim abstract and introduction.
- **Chinese sub-page**: 3000-8000 Chinese characters, ≥40 blocks, same figures/tables/equations as English. **NOT a summary — a full mirror with verbatim-translated abstract and introduction.**
- **Both pages must include**: all figures, all data tables, all equations, all callouts, all references.

## Content Guidelines

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
