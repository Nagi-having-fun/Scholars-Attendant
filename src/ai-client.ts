/**
 * AI API client for generating paper summaries in API mode.
 * Supports Anthropic, OpenAI, Google Gemini, and DeepSeek.
 */

type Message = { role: "system" | "user" | "assistant"; content: string };

type AIClientConfig = {
  model: string;
  maxTokens?: number;
};

function resolveProvider(model: string): "anthropic" | "openai" | "google" | "deepseek" {
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("gpt") || model.startsWith("o3") || model.startsWith("o4")) return "openai";
  if (model.startsWith("gemini")) return "google";
  if (model.startsWith("deepseek")) return "deepseek";
  // Default to anthropic for unknown models
  return "anthropic";
}

function resolveApiKey(provider: string): string {
  const envKeys: Record<string, string[]> = {
    anthropic: ["ANTHROPIC_API_KEY"],
    openai: ["OPENAI_API_KEY"],
    google: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
    deepseek: ["DEEPSEEK_API_KEY"],
  };
  for (const key of envKeys[provider] ?? []) {
    const val = process.env[key];
    if (val) return val;
  }
  throw new Error(
    `No API key found for ${provider}. Set one of: ${(envKeys[provider] ?? []).join(", ")}`,
  );
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: Message[],
  maxTokens: number,
): Promise<string> {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const userMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: userMessages,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`Anthropic API ${resp.status}: ${err.slice(0, 300)}`);
  }
  const data = (await resp.json()) as { content: Array<{ text: string }> };
  return data.content.map((c) => c.text).join("");
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: Message[],
  maxTokens: number,
): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`OpenAI API ${resp.status}: ${err.slice(0, 300)}`);
  }
  const data = (await resp.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

async function callGoogle(
  apiKey: string,
  model: string,
  messages: Message[],
  maxTokens: number,
): Promise<string> {
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  const systemInstruction = messages.find((m) => m.role === "system");

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`Google API ${resp.status}: ${err.slice(0, 300)}`);
  }
  const data = (await resp.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  return data.candidates[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
}

async function callDeepSeek(
  apiKey: string,
  model: string,
  messages: Message[],
  maxTokens: number,
): Promise<string> {
  // DeepSeek uses OpenAI-compatible API
  const resp = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`DeepSeek API ${resp.status}: ${err.slice(0, 300)}`);
  }
  const data = (await resp.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

export async function generateCompletion(
  config: AIClientConfig,
  messages: Message[],
): Promise<string> {
  const provider = resolveProvider(config.model);
  const apiKey = resolveApiKey(provider);
  const maxTokens = config.maxTokens ?? 8192;

  switch (provider) {
    case "anthropic":
      return callAnthropic(apiKey, config.model, messages, maxTokens);
    case "openai":
      return callOpenAI(apiKey, config.model, messages, maxTokens);
    case "google":
      return callGoogle(apiKey, config.model, messages, maxTokens);
    case "deepseek":
      return callDeepSeek(apiKey, config.model, messages, maxTokens);
  }
}

/** Generate a blog-style paper summary given paper text content. */
export async function generatePaperSummary(params: {
  model: string;
  paperTitle: string;
  paperContent: string;
  figureUrls: string[];
  includeImages: boolean;
  language: "en" | "zh";
}): Promise<string> {
  const { model, paperTitle, paperContent, figureUrls, includeImages, language } = params;

  const figureBlock = includeImages && figureUrls.length > 0
    ? `\n\nValidated figure URLs (use these in the blog):\n${figureUrls.map((u, i) => `Figure ${i + 1}: ${u}`).join("\n")}`
    : "\n\n> Note: This paper contains no figures.";

  const langInstructions = language === "zh"
    ? `Write ENTIRELY in Chinese. Translate all section headings, captions, and prose to Chinese.
Keep LaTeX formulas, image URLs, and reference author names in English.
Use 一句话总结 for TL;DR, 摘要（原文）for Abstract, 引言 for Introduction, 方法 for Method, 实验结果 for Results, 核心要点 for Key Takeaways, 参考文献 for References.`
    : `Write in English.`;

  const imageInstructions = includeImages
    ? `Insert figures at appropriate positions using: ![Figure N: descriptive caption](url)`
    : `Do NOT include any images. Skip all figure references.`;

  const systemPrompt = `You are a research paper summarizer creating Notion blog-style pages.
${langInstructions}
${imageInstructions}

Output format (Notion-flavored markdown):
# ${paperTitle}
**Authors:** ...
**arXiv:** [ID](url)
---
## TL;DR
2-3 sentence summary.
---
## Abstract (Verbatim)
> Full abstract in blockquote.
---
## Introduction
Key paragraphs from introduction.
---
## Method / Approach
Equations as $$...$$, inline math as $...$
Tables as <table header-row="true"><tr><td>...</td></tr></table>
---
## Results
Key findings with tables.
---
## Key Takeaways
<callout icon="💡">
Core insight.
</callout>
---
## References
- Author et al. (Year). Title. arXiv:XXXX.XXXXX.`;

  const userMessage = `Create a comprehensive blog-style summary (3000-8000 words, ≥40 blocks) for this paper:

${paperContent.slice(0, 60000)}${figureBlock}`;

  return generateCompletion(
    { model, maxTokens: 16384 },
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  );
}
