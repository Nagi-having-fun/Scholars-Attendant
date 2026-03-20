---
name: paper-parse
description: Parse and extract formulas, symbols, tables from research papers with correct formatting and numbering. Supports two methods - PDF text extraction and image-based visual parsing. Use when the user needs to see specific equations, tables, or mathematical content from a paper.
---

# Paper Parse — Formula, Symbol & Table Extraction

Extract and render mathematical formulas, symbols, and tables from research papers with correct LaTeX formatting and original numbering.

## When to Use

- User asks about specific equations or formulas in a paper
- User wants to see a paper's tables with correct formatting
- User needs the notation/symbol table from a paper
- User asks to extract all math from a paper
- Before creating a Notion blog page (paper-to-notion), to gather formatted content

## Two Extraction Methods

### Method A: PDF Text Extraction (preferred for arXiv papers)

Best for: arXiv papers, papers with selectable text, clean LaTeX source.

1. **Try AlphaXiv first** — fetch `https://alphaxiv.org/abs/{PAPER_ID}.md` via `web_fetch`. This often contains pre-extracted equations and tables.

2. **Fetch the PDF as text** — use `web_fetch` on `https://arxiv.org/pdf/{PAPER_ID}` and extract text content.

3. **Fetch LaTeX source** (most reliable for equations):
   ```
   https://arxiv.org/e-print/{PAPER_ID}
   ```
   This downloads the LaTeX source. If available, extract equations directly from `\begin{equation}`, `\begin{align}`, `$...$`, `$$...$$` environments.

4. **Parse and format**:
   - Preserve original equation numbers: `(1)`, `(2)`, etc.
   - Keep `\label{}` references intact for cross-referencing
   - Render inline math as `$...$` and display math as `$$...$$`
   - For aligned multi-line equations, use `\begin{aligned}...\end{aligned}`

### Method B: Image-Based Visual Parsing (for non-arXiv or scanned papers)

Best for: non-arXiv papers, scanned PDFs, WeChat/Xiaohongshu posts about papers.

1. **Use the `browser` tool** to open the paper PDF or page
2. **Screenshot each page** containing equations/tables
3. **Visually read** the equations from screenshots:
   - Identify each equation number
   - Transcribe to LaTeX notation
   - Verify symbol consistency (same symbol = same LaTeX command throughout)
4. **For tables**: read row by row, preserving column alignment

## Output Format

### Equations

Present equations in order with their original numbering:

```
**Equation (1)** — [Brief description]
$$
\mathcal{L}(\theta) = \mathbb{E}_{(x,y) \sim \mathcal{D}} \left[ \log p_\theta(y | x) \right]
$$

**Equation (2)** — [Brief description]
$$
\nabla_\theta J(\theta) = \mathbb{E}_{\tau \sim \pi_\theta} \left[ \sum_{t=0}^{T} \nabla_\theta \log \pi_\theta(a_t | s_t) \cdot R(\tau) \right]
$$
```

### Symbol Table

After listing equations, provide a symbol reference:

| Symbol | Meaning |
|--------|---------|
| $\theta$ | Model parameters |
| $\mathcal{D}$ | Training dataset |
| $\pi_\theta$ | Policy parameterized by $\theta$ |

### Tables

Reproduce tables with proper formatting:

```
**Table 1** — [Caption]

| Method | Accuracy | F1 Score |
|--------|----------|----------|
| Baseline | 78.3 | 76.1 |
| Ours | **82.7** | **80.4** |
```

## Quality Checks

After extraction, verify:

1. **Numbering continuity** — no gaps in equation numbers
2. **Symbol consistency** — same concept uses same symbol throughout
3. **Bracket matching** — all `\left(` have matching `\right)`, etc.
4. **Subscript/superscript** — correctly nested: `x_{i}^{(k)}` not `x_i^(k)`
5. **Special functions** — use `\log`, `\exp`, `\max`, `\min` (not italic versions)
6. **Bold/calligraphic** — distinguish `\mathbf{x}` (vector), `\mathcal{L}` (loss), `\mathbb{R}` (reals)

## Common LaTeX Patterns in ML Papers

| Pattern | LaTeX |
|---------|-------|
| Expectation | `\mathbb{E}_{x \sim p}[f(x)]` |
| KL divergence | `D_{\mathrm{KL}}(p \| q)` |
| Gradient | `\nabla_\theta` |
| Argmax | `\arg\max_\theta` |
| Loss function | `\mathcal{L}(\theta)` |
| Norm | `\| x \|_2` or `\lVert x \rVert_2` |
| Matrix | `\mathbf{W} \in \mathbb{R}^{d \times d}` |
| Softmax | `\mathrm{softmax}(z_i)` |
| Indicator | `\mathbb{1}[condition]` |

## Notes

- When both methods are available, prefer Method A (text extraction) for accuracy
- For papers with heavy custom notation, extract the "Notation" or "Preliminaries" section first
- If LaTeX source is not available, state which equations were visually transcribed (may have minor inaccuracies)
- Tables with merged cells: describe the merge in a note below the table
