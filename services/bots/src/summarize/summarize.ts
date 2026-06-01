import type { SummarizerConfig } from "../config.js";

const SYSTEM_PROMPT =
  "Summarize the following for developers in 2–3 sentences. Be factual and specific. No markdown, no hype, no \"this article discusses\".";

export type SummarizeDeps = {
  fetchImpl?: typeof fetch;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

export function buildSummarizeUserPrompt(title: string, content: string): string {
  return `Title: ${title}\n\nContent:\n${content}`;
}

export async function summarizeText(
  title: string,
  content: string,
  config: SummarizerConfig,
  deps: SummarizeDeps = {},
): Promise<string | null> {
  const apiKey = config.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 180,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: buildSummarizeUserPrompt(title, content),
        },
      ],
    }),
  });

  const data = (await response.json()) as OpenAIChatResponse;
  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        `OpenAI request failed (${response.status})`,
    );
  }

  const summary = data.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    return null;
  }

  return truncate(summary, config.SUMMARY_MAX_OUTPUT_CHARS);
}
