import { ImagePayload, VisionProvider, ProviderError } from "./types.js";
import { callOpenAiCompatibleVision } from "./openaiCompatible.js";

// Cerebras currently only supports vision on gemma-4-31b, with a hard cap
// of 280 image tokens per image (large/detailed images get downsampled
// server-side). Good as a fallback, not ideal as a primary provider for
// detail-heavy descriptions.
const DEFAULT_MODEL = "gemma-4-31b";
const BASE_URL = "https://api.cerebras.ai/v1";

export class CerebrasProvider implements VisionProvider {
  readonly id = "cerebras";
  readonly label = "Cerebras";
  readonly models: string[];

  constructor(
    private apiKey: string | undefined = process.env.CEREBRAS_API_KEY,
    models: string[] = [
      process.env.CEREBRAS_VISION_MODEL || DEFAULT_MODEL,
    ]
  ) {
    this.models = models;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async describe(image: ImagePayload, prompt: string, model: string): Promise<string> {
    if (!this.apiKey) {
      throw new ProviderError(this.id, "CEREBRAS_API_KEY is not set");
    }
    return callOpenAiCompatibleVision({
      providerId: this.id,
      baseUrl: BASE_URL,
      apiKey: this.apiKey,
      model,
      image,
      prompt,
    });
  }
}
