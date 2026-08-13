export interface ImagePayload {
  /** Full data URI, e.g. "data:image/png;base64,...." */
  dataUri: string;
  mimeType: string;
}

export interface VisionProvider {
  /** Stable id used in config/env, e.g. "gemini" | "groq" | "cerebras" */
  readonly id: string;

  /** Human readable name, for error messages/logs */
  readonly label: string;

  /**
   * Ordered list of models to try for this provider, in fallback order.
   * The orchestrator tries each model one at a time until one succeeds.
   */
  readonly models: string[];

  /** True if the required API key/env var is present */
  isConfigured(): boolean;

  /**
   * Send the image + prompt to the provider using the given model and return
   * the text description. Should throw on any failure (network, auth, rate
   * limit) with a message that includes enough context to show the user
   * (e.g. HTTP status).
   */
  describe(image: ImagePayload, prompt: string, model: string): Promise<string>;
}

export class ProviderError extends Error {
  constructor(public providerId: string, message: string, public cause?: unknown) {
    super(`[${providerId}] ${message}`);
    this.name = "ProviderError";
  }
}
