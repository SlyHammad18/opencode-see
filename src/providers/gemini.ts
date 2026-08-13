import { ImagePayload, ProviderError, VisionProvider } from "./types.js";

const DEFAULT_MODEL = "gemini-2.5-flash";const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 20_000;

export class GeminiProvider implements VisionProvider {
  readonly id = "gemini";
  readonly label = "Gemini";
  readonly models: string[];

  constructor(
    private apiKey: string | undefined = process.env.GEMINI_API_KEY,
    models: string[] = [
      process.env.GEMINI_VISION_MODEL || DEFAULT_MODEL,
    ]
  ) {
    this.models = models;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async describe(image: ImagePayload, prompt: string, model: string): Promise<string> {
    if (!this.apiKey) {
      throw new ProviderError(this.id, "GEMINI_API_KEY is not set");
    }

    const base64 = image.dataUri.split(",")[1] ?? image.dataUri;
    const url = `${API_BASE}/${model}:generateContent?key=${this.apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: image.mimeType, data: base64 } },
              ],
            },
          ],
        }),
      });
    } catch (err) {
      throw new ProviderError(this.id, "network error or timeout", err);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = await safeText(res);
      throw new ProviderError(this.id, `HTTP ${res.status}: ${body}`);
    }

    const json: any = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new ProviderError(this.id, "empty response from Gemini");
    }
    return text.trim();
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<no body>";
  }
}
