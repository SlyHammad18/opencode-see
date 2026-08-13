import { ImagePayload, VisionProvider, ProviderError } from "./types.js";
import { callOpenAiCompatibleVision } from "./openaiCompatible.js";

// NOTE: Groq rotates/deprecates vision models fairly often.
// Check https://console.groq.com/docs/vision for the current model id
// and set GROQ_VISION_MODEL if this default goes stale.
const DEFAULT_MODEL = "qwen/qwen3.6-27b";
const BASE_URL = "https://api.groq.com/openai/v1";

export class GroqProvider implements VisionProvider {
  readonly id = "groq";
  readonly label = "Groq";
  readonly models: string[];

  constructor(
    private apiKey: string | undefined = process.env.GROQ_API_KEY,
    models: string[] = [
      process.env.GROQ_VISION_MODEL || DEFAULT_MODEL,
    ]
  ) {
    this.models = models;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async describe(images: ImagePayload[], prompt: string, model: string): Promise<string> {
    if (!this.apiKey) {
      throw new ProviderError(this.id, "GROQ_API_KEY is not set");
    }
    return callOpenAiCompatibleVision({
      providerId: this.id,
      baseUrl: BASE_URL,
      apiKey: this.apiKey,
      model,
      images,
      prompt,
    });
  }
}
