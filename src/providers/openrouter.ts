import type { ImagePayload, VisionProvider } from "./types.js";
import { callOpenAiCompatibleVision } from "./openaiCompatible.js";

const BASE_URL = "https://openrouter.ai/api/v1";

export class OpenRouterProvider implements VisionProvider {
  readonly id = "openrouter";
  readonly label = "OpenRouter";

  constructor(
    private apiKey: string | undefined,
    readonly models: string[]
  ) {}

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async describe(images: ImagePayload[], prompt: string, model: string): Promise<string> {
    return callOpenAiCompatibleVision({
      providerId: this.id,
      baseUrl: BASE_URL,
      apiKey: this.apiKey!,
      model,
      images,
      prompt,
    });
  }
}
