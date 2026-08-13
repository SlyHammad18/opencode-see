import { ImagePayload, ProviderError, VisionProvider } from "./providers/types.js";

export interface DescribeResult {
  text: string;
  providerUsed: string;
  /** Model id that produced the description */
  model: string;
}

/**
 * Tries each provider in `providers` order, and within each provider tries
 * its models one at a time. Returns as soon as one (provider, model) combo
 * succeeds — never calls more than one provider/model per request, and never
 * merges/compares outputs.
 * If every provider and model fails (or is unconfigured), throws an error
 * that lists what happened with each attempt.
 */
export async function describeImageWithFallback(
  providers: VisionProvider[],
  images: ImagePayload[],
  prompt: string
): Promise<DescribeResult> {
  const attempts: string[] = [];

  for (const provider of providers) {
    if (!provider.isConfigured()) {
      attempts.push(`${provider.label}: skipped (no API key configured)`);
      continue;
    }

    for (const model of provider.models) {
      try {
        const text = await provider.describe(images, prompt, model);
        return { text, providerUsed: provider.label, model };
      } catch (err) {
        const message = err instanceof ProviderError ? err.message : String(err);
        attempts.push(`${provider.label} (${model}): failed (${message})`);
        // continue to next model/provider
      }
    }
  }

  throw new Error(
    `All providers failed or were unconfigured:\n` + attempts.map((a) => `  - ${a}`).join("\n")
  );
}
