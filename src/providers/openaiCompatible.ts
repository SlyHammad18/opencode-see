import { ImagePayload, ProviderError } from "./types.js";

const TIMEOUT_MS = 20_000;

/**
 * Calls an OpenAI-compatible /chat/completions endpoint with a single
 * user message containing text + an image_url content block.
 * Groq and Cerebras both speak this dialect.
 */
export async function callOpenAiCompatibleVision(opts: {
  providerId: string;
  baseUrl: string; // e.g. "https://api.groq.com/openai/v1"
  apiKey: string;
  model: string;
  image: ImagePayload;
  prompt: string;
}): Promise<string> {
  const { providerId, baseUrl, apiKey, model, image, prompt } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: image.dataUri } },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    throw new ProviderError(providerId, "network error or timeout", err);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await safeText(res);
    throw new ProviderError(providerId, `HTTP ${res.status}: ${body}`);
  }

  const json: any = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) {
    throw new ProviderError(providerId, "empty response");
  }
  return String(text).trim();
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<no body>";
  }
}
