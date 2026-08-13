export type ProviderId = "gemini" | "groq" | "cerebras";

const ALL_PROVIDERS: ProviderId[] = ["gemini", "groq", "cerebras"];
const DEFAULT_ORDER: ProviderId[] = ["gemini", "groq", "cerebras"];
const DEFAULT_PROMPT = "Describe this image in detail.";

/**
 * Options accepted from opencode.json via the plugin tuple form:
 *   ["opencode-see", { "apiKeys": { "gemini": "..." }, ... }]
 *
 * Every field is optional; each falls back to the matching env var when unset.
 */
export interface DescribeImagePluginOptions {
  apiKeys?: Partial<Record<ProviderId, string>>;
  /** Ordered list of models to try per provider, e.g. { "groq": ["a", "b"] } */
  models?: Partial<Record<ProviderId, string[]>>;
  /** Comma-separated provider order, e.g. "cerebras,gemini,groq" */
  providerOrder?: string;
  defaultPrompt?: string;
}

export interface DescribeImageConfig {
  providerOrder: ProviderId[];
  defaultPrompt: string;
}

/**
 * Resolves the provider order, in priority:
 * 1. Explicit override passed to the tool call (args.providers)
 * 2. Plugin option (opencode.json providerOrder)
 * 3. DESCRIBE_IMAGE_PROVIDER_ORDER env var
 * 4. Built-in default: gemini, groq, cerebras
 *
 * Unknown provider ids are ignored with a console warning rather than
 * throwing, so a typo doesn't take the whole tool down.
 */
export function resolveProviderOrder(
  overrideCsv?: string,
  configuredCsv?: string
): ProviderId[] {
  const source = overrideCsv || configuredCsv || process.env.DESCRIBE_IMAGE_PROVIDER_ORDER;
  if (!source) return DEFAULT_ORDER;

  const requested = source
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as ProviderId[];

  const valid = requested.filter((p) => ALL_PROVIDERS.includes(p));
  const invalid = requested.filter((p) => !ALL_PROVIDERS.includes(p));

  if (invalid.length) {
    console.warn(
      `[describe_image] ignoring unknown provider id(s): ${invalid.join(", ")}. ` +
        `Valid ids: ${ALL_PROVIDERS.join(", ")}`
    );
  }

  return valid.length ? valid : DEFAULT_ORDER;
}

export function loadConfig(options?: DescribeImagePluginOptions): DescribeImageConfig {
  return {
    providerOrder: resolveProviderOrder(undefined, options?.providerOrder),
    defaultPrompt:
      options?.defaultPrompt ||
      process.env.DESCRIBE_IMAGE_DEFAULT_PROMPT ||
      DEFAULT_PROMPT,
  };
}

const MODEL_ENV_VARS: Record<ProviderId, string> = {
  gemini: "GEMINI_VISION_MODEL",
  groq: "GROQ_VISION_MODEL",
  cerebras: "CEREBRAS_VISION_MODEL",
};

const DEFAULT_MODELS: Record<ProviderId, string[]> = {
  gemini: ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-3.1-flash-lite"],
  groq: ["qwen/qwen3.6-27b"],
  cerebras: ["gemma-4-31b"],
};

/**
 * Resolves the ordered model list for a provider, in priority:
 * 1. Plugin option (opencode.json models.<id>, an array)
 * 2. <PROVIDER>_VISION_MODEL env var (single value)
 * 3. Built-in default
 */
export function resolveModels(
  provider: ProviderId,
  options?: DescribeImagePluginOptions
): string[] {
  const fromOptions = options?.models?.[provider];
  if (fromOptions && fromOptions.length) {
    return fromOptions.map((m) => m.trim()).filter(Boolean);
  }
  const fromEnv = process.env[MODEL_ENV_VARS[provider]];
  if (fromEnv) {
    return [fromEnv.trim()];
  }
  return DEFAULT_MODELS[provider];
}
