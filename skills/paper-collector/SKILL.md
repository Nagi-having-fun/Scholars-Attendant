---
name: paper-collector
description: "MUST USE when the user sends any URL (arXiv, Xiaohongshu, WeChat, X/Twitter, GitHub, blog, etc.). Saves metadata via notion_save_paper, then AUTOMATICALLY generates English + Chinese blog-style Notion pages (notion_write_page REJECTS content under 40 blocks). Pages must include VERBATIM abstract, VERBATIM introduction, complete tables, figures, and ALL references. Do NOT wait for user to ask — auto-generate immediately after saving metadata."
---

# Paper Collector

When a user sends a message containing a URL, evaluate whether the content is research or paper-related. If it is, extract structured metadata and save it to Notion using the `notion_save_paper` tool.

## CRITICAL: Progress Reporting & Failure Handling

**You MUST send status messages to the user throughout the workflow.** Never go silent. The user should always know what is happening.

### Required status messages (send these as replies to the user):

1. **Immediately after receiving a URL**: "📄 Processing paper link... fetching content."
2. **After identifying the paper**: "Found: *{Paper Title}* by {Authors}. Saving metadata to Notion..."
3. **After saving metadata**: "✅ Metadata saved. Now generating blog-style summary (this takes 1-2 minutes)..."
4. **During content gathering**: "🔍 Gathering content: fetching AlphaXiv overview, full text, and figures..."
5. **After writing English page**: "✅ English blog page written ({N} blocks, {M} figures). Now creating Chinese translation..."
6. **After writing Chinese page**: "✅ Done! English + Chinese pages created.\n📖 {Notion URL}"
7. **On ANY failure**: "❌ Failed at step: {step name}. Reason: {specific error}. {What I'll try next / what you can do}"

### Failure reporting rules:

- **NEVER silently fail.** If ANY step fails, you MUST tell the user what happened and why.
- If `web_fetch` fails: report the URL and error, explain what fallback you're trying.
- If `notion_write_page` rejects content (quality gate): tell the user "Content was too short ({N} blocks), gathering more data..." then retry.
- If AlphaXiv is unavailable (404): tell the user, then fall back to arXiv abstract + HTML.
- If no figures found after trying all sources: tell the user "Could not find figure images from arXiv HTML, GitHub, or browser. The page will have text-only content."
- If the entire workflow fails: give a detailed failure report with what was attempted and what went wrong.

### Answering "how's it going?" / status queries:

**IMPORTANT**: If the user sends ANY message while you are still processing a paper (e.g., "找得怎么样了", "how's it going?", "进度如何", "done yet?"), you MUST immediately reply with your current status. Do NOT ignore the message. Respond with:
- What paper you're processing (title if known, URL if not yet identified)
- Which step you're currently on: (1) fetching URL content, (2) identifying paper, (3) saving metadata, (4) gathering blog content, (5) writing English page, (6) writing Chinese page
- Any issues encountered so far (e.g., "AlphaXiv returned 404, falling back to arXiv HTML")
- What's left to do

### Completion notification:

**MANDATORY**: After finishing the ENTIRE workflow (metadata + English + Chinese), you MUST send a final summary message to the user. Even if the user hasn't asked. The message should include:
- Paper title and authors
- Notion page link
- Block counts (English + Chinese)
- Figure count
- Any issues or compromises made during processing

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

This applies to ALL platforms. Many platforms (Xiaohongshu, WeChat, X) will block `web_fetch`. This is expected — always fall back.

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

### Step 1c: Image-based paper inference (MANDATORY when no paper title/link found)

**CRITICAL: If after Step 1 and Step 1b you still do NOT have a clear paper title or paper link, you MUST attempt image-based inference. Do NOT skip this step. Do NOT give up.**

This step handles the common case where social media posts (Xiaohongshu, WeChat, X) discuss a paper primarily through images — paper screenshots, architecture diagrams, figure reproductions, slides — rather than text.

#### Strategy A: Extract images from HTML

1. If `web_fetch` returned HTML content (even if text was sparse), call `extract_page_images` with the raw HTML and the page URL as `base_url`.
2. The tool returns a ranked list of image URLs (og:image first, then content images).
3. Use `web_fetch` on the top image URLs (start with og:image and the first 3-5 content images) to **view them visually**.
4. In each image, look for:
   - **Paper title** (often visible in screenshots of the paper's first page or in slide headers)
   - **arXiv ID** (e.g., `arXiv:2301.12345` printed on the paper)
   - **Author names** (visible on paper headers)
   - **Architecture/method diagrams** with a named method (e.g., "DiT", "Mamba", "RLHF")
   - **Figure captions** that reference a paper or method name
   - **Conference/journal logos** (NeurIPS, ICML badge, etc.)
   - **DOI** or URL printed on the image
   - **Table headers** with benchmark/dataset names
   - **Chinese text** that translates or refers to a paper title

#### Strategy B: Browser screenshots of images

If Strategy A doesn't yield enough clues (images blocked, or `extract_page_images` found nothing):

1. Use `browser` to navigate to the URL
2. Take screenshots while scrolling through the entire post
3. Focus on each embedded image — zoom in if needed: `browser action=click` on images to view full-size
4. Apply the same visual analysis as Strategy A

#### Strategy C: Reverse-image reasoning

From whatever visual clues you gathered (even partial), construct search queries:

1. **Method/model name spotted** (e.g., "FlashAttention", "LLaVA", diagram labeled "our method"):
   → `web_search` for `"<method name>" paper arxiv`
2. **Architecture diagram style recognized** (e.g., Transformer blocks, diffusion pipeline):
   → combine with any visible text/keywords to search
3. **Figure number + caption fragments** (e.g., "Figure 3: Comparison of..."):
   → search for the caption text
4. **Chinese title/summary visible in image**:
   → translate to English, then search for the English paper title
5. **Author names visible** (even partial):
   → `web_search` for `"<author name>" <topic keywords> paper 2024`
6. **Conference badge/watermark** (e.g., "Accepted at ICLR 2025"):
   → narrow search by conference: `"<any keyword>" ICLR 2025 paper`
7. **Benchmark results table visible** with specific numbers:
   → search for the dataset name + task + approximate scores

#### Combining clues

You often won't get the full paper title from a single image. Combine clues across multiple images and any text fragments:

- Image 1 shows an architecture diagram labeled "X-Former"
- Image 2 shows a results table on ImageNet
- Post text mentions "SOTA performance"
- → search: `"X-Former" ImageNet paper arxiv`

**Keep searching until you find the paper or exhaust all clues. Try at least 3 different search queries before concluding the paper cannot be identified.**

### Step 2: Evaluate relevance

From whatever content you gathered (text + visual + image inference), determine if this is about a specific research paper. Look for:
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
- **institutions**: An array of institution tags for the **first author** and **corresponding author** (last author or marked with *). **ALWAYS use short abbreviations** — e.g., "MIT", "Stanford", "ETH", "THU" (Tsinghua), "PKU" (Peking), "CMU", "UIUC", "MSR" (Microsoft Research), "UCSC", "GaTech", "UW" (Washington), "MSU" (Michigan State), "CAS" (Chinese Academy of Sciences), "SJTU" (Shanghai Jiao Tong), "UMass", "AI2" (Allen Institute), "CAIS" (Center for AI Safety), "TUM" (TU Munich). Never use full names like "University of XXX" — always abbreviate.
- **published_date**: In YYYY-MM-DD format if available
- **source_url**: The original URL the user sent
- **paper_url**: Direct link to the paper itself (arXiv abs page, DOI URL, etc.)
- **summary**: One-sentence summary of what the paper does
- **contributions**: 2-3 sentences on main contributions
- **tags**: English research area tags. **Tag hygiene rules:**
  - **Do NOT use overly broad tags** like "LLM", "NLP", "deep learning", "computer vision" — these apply to almost every paper and add no filtering value.
  - **Do NOT use paper-specific tags** like method names ("SimNPO", "FLAT"), dataset names ("TOFU", "MUSE", "WMDP"), or benchmark names that only relate to one paper — use general category tags instead (e.g., "machine unlearning", "benchmark", "preference optimization").
  - **Do NOT put conference/venue names in tags** — use the separate `conference` field on the database instead.
  - **Good tags** are mid-level research topics: "machine unlearning", "agent memory", "reinforcement learning", "preference optimization", "knowledge tracing", "dialogue tutoring", "benchmark", "survey", etc.

### Step 5: Save to Notion

Call `notion_save_paper` with the extracted metadata. **Tell the user**: "✅ Metadata saved for *{title}*. Now generating blog summary..."

**IMPORTANT**: The `notion_save_paper` response contains the page ID and URL. Save these — you need the page ID for `notion_write_page` and `notion_create_child_page`.

### Step 6: Auto-generate blog summary

**MANDATORY**: After successfully saving metadata to Notion, automatically generate a full blog-style summary page. Do NOT wait for user to ask — this is part of the default workflow.

**Tell the user**: "🔍 Gathering content from AlphaXiv, arXiv, and GitHub..."

#### 6a: Gather ALL content first (DO NOT SKIP)

You MUST complete ALL of these fetch steps before writing. Do them in parallel where possible:

1. **Fetch AlphaXiv overview** — `web_fetch` on `https://alphaxiv.org/overview/{PAPER_ID}.md`
   - If 404: report to user ("AlphaXiv overview unavailable, using arXiv abstract instead"), use the abstract from Step 1.
2. **Fetch AlphaXiv full text** — `web_fetch` on `https://alphaxiv.org/abs/{PAPER_ID}.md`
   - This contains **complete table data** (all rows, all columns). Without it, your tables will be incomplete.
   - If 404: report to user, fall back to extracting table data from arXiv HTML or abstract.
3. **Fetch figures** — you MUST try ALL sources. Do NOT stop after one source:

   **Source A — PDF browser screenshots (PREFERRED — most reliable):**
   - Navigate to `https://arxiv.org/pdf/{PAPER_ID}` with `browser`
   - Screenshot every page that contains a figure, diagram, or results chart
   - This is the BEST source because: (1) every paper has a PDF, (2) screenshots capture complete composite figures, (3) no risk of URL hallucination
   - Each screenshot produces a URL you can embed directly: `![Fig. N: caption](screenshot_url)`

   **Source B — GitHub repo** (often has high-quality figures):
   - `web_search` for `"{paper title}" github`
   - Fetch the repo README — figures are usually embedded there
   - Figure URLs follow: `https://github.com/{org}/{repo}/raw/main/figures/{name}.png`

   **Source C — arXiv HTML** (USE WITH CAUTION):
   - `web_fetch` on `https://arxiv.org/html/{PAPER_ID}`
   - **WARNING: arXiv HTML often splits composite figures into tiny sub-images (legends, sub-panels, axis labels) that are < 10KB each. The `notion_write_page` tool will REJECT images smaller than 10KB.**
   - Only use arXiv HTML images if they are COMPLETE figures (> 10KB). Check by looking at the `<figure>` element — if it contains multiple `<img>` tags, those are fragments, NOT complete figures.
   - If web_fetch returns image URLs, verify they are full figures before using them.

   **Source D — ar5iv (alternative HTML renderer):**
   - `web_fetch` on `https://ar5iv.labs.arxiv.org/html/{PAPER_ID}` — same caution as Source C

   **Goal: capture ALL figures that exist in the paper** — not a fixed number. If the paper has 4 figures, get all 4. If it has 12, get all 12.
   If you have 0 figures after trying all sources, you MUST report this to the user.
   **Report to user what you found**: "Found {N} figures from {source} (paper contains approximately {M} figures total)."

#### 6b: Compose English blog page

**Quality standard (Keshav's two-pass reading depth)**: A reader of this page must be able to **summarize the paper's main thrust, with supporting evidence, to someone else** — without reading the original paper. This means detailed method explanation, complete results with specific numbers, and all key figures embedded.

Write a **3000-8000 word** blog-style page with these sections:
- **TL;DR** (1-2 sentences — the core contribution in plain language)
- **Abstract** (VERBATIM — copy word-for-word from the paper, do NOT paraphrase)
- **Introduction** (VERBATIM — copy the full original introduction, preserving all paragraphs and citations)
- **Background** (2-3 paragraphs: what problem exists, what came before, what gap remains)
- **Method** (detailed step-by-step: "The approach works by (1)..., (2)..., (3)..." — include architecture figures, key equations with explanation of each term)
- **Experiments** (setup, results figures, **complete data tables with ALL rows/columns** — use markdown pipe-style tables `| col | col |`, include specific numbers and comparisons)
- **Discussion** (limitations, ablation studies, what doesn't work, open questions)
- **Key Takeaways** (bulleted list of 5-8 concrete points)
- **References** (ALL references from the paper, numbered, hyperlinked — not just the ones you cite)

Call `notion_write_page` with the composed markdown.

**If `notion_write_page` REJECTS the content** (quality gate: < 25 blocks):
1. **Tell the user**: "Content was too short ({N} blocks). Gathering more data and retrying..."
2. Go back to 6a and fetch ANY sources you skipped
3. Expand your content: add more detail to Method and Experiments sections, include more equations, add more figures
4. Retry `notion_write_page` with the expanded content
5. If rejected again after 2 attempts, tell the user with details

**Tell the user after success**: "✅ English blog page written ({N} blocks, {M} figures)."

#### 6c: Create Chinese sub-page

**MANDATORY.** Create a complete Chinese translation as a child page.

**Quality standard (Keshav's two-pass depth)**: After reading only the Chinese page, a reader must be able to **summarize the paper's approach, results, and contributions with supporting evidence to someone else** — without ever opening the original paper. Concretely, the reader must be able to answer:
- What problem does the paper solve? (motivation + research gap)
- How does the method work? (step-by-step, with key equations explained)
- What are the specific results? (numbers, comparisons, trends — not "achieves SOTA")
- What do the figures show? (every figure embedded with explanatory caption)
- How does this relate to prior work?
- What are the limitations?

**How to do this**: Take the EXACT English markdown from 6b. Translate every paragraph of prose to Chinese. Keep ALL of the following unchanged:
- Image URLs and markdown syntax (`![caption](url)`)
- Table markup and data values
- LaTeX equations (`$...$` and `$$...$$`)
- Callout markup
- Reference list entries

The Chinese page must have the **same number of sections, figures, tables, and equations** as the English page. It must be **2000-5000 Chinese characters**. NOT a short summary — a full-depth mirror.

Call `notion_create_child_page` with `parent_page_id` set to the page from Step 5, title set to the **paper's original English title** (e.g., "Machine Unlearning"), icon "🇨🇳".

**If rejected by quality gate**: same retry procedure as 6b.

**Tell the user after success**: "✅ Chinese translation page created ({N} blocks)."

### Step 7: Reply to user

Final confirmation with:
- Paper title and authors
- One-line summary
- Notion link
- Stats: "{N} blocks English, {M} blocks Chinese, {K} figures"

If the paper was identified through image inference, also mention how.

**If any step failed**, include a failure report:
- Which step failed
- What error occurred
- What was attempted as a fallback
- What the user can do (e.g., "try sending the arXiv link directly")

### Step 8: Offer additional actions

After saving metadata and generating the blog summary, offer the user these follow-up actions:

- **"Want a more detailed summary?"** → Use `alphaxiv-lookup` for a structured overview
- **"Want to see the equations/tables?"** → Use `paper-parse` to extract formatted math and tables
- **"Save figures?"** → Use `paper-figures` to extract and list all paper figures

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
- **Images are blurry or low-resolution**: Extract whatever partial text is visible, use it as search keywords
- **Multiple candidate papers from image clues**: Use `web_search` to verify which paper matches the visual content, then pick the best match
- **Image shows a figure from a survey/review paper**: Check if the post discusses the specific cited paper or the survey itself
