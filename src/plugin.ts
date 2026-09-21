import { Plugin } from "@opencode/plugin";
import type { Context } from "@opencode/plugin/promise/plugin";
import { loadImageAsDataUri } from "./image.js";
import {
  loadConfig,
  resolveModels,
  resolveProviderOrder,
  type OpenCodeSeePluginOptions,
  type ProviderId,
} from "./config.js";
import { describeImageWithFallback } from "./orchestrator.js";
import { GeminiProvider } from "./providers/gemini.js";
import { GroqProvider } from "./providers/groq.js";
import { CerebrasProvider } from "./providers/cerebras.js";
import { OpenRouterProvider } from "./providers/openrouter.js";
import type { VisionProvider } from "./providers/types.js";

const TOOL_DESCRIPTION =
  "Get a text description of one or more images (local file paths or http(s) URLs) from a vision model. " +
  "Tries providers one at a time in order (Gemini, Groq, Cerebras, and OpenRouter by default), " +
  "trying each provider's models in order, and returns the first successful description.";

function buildProviderRegistry(
  options?: OpenCodeSeePluginOptions
): Record<ProviderId, VisionProvider> {
  return {
    gemini: new GeminiProvider(
      options?.apiKeys?.gemini,
      resolveModels("gemini", options)
    ),
    groq: new GroqProvider(
      options?.apiKeys?.groq,
      resolveModels("groq", options)
    ),
    cerebras: new CerebrasProvider(
      options?.apiKeys?.cerebras,
      resolveModels("cerebras", options)
    ),
    openrouter: new OpenRouterProvider(
      options?.apiKeys?.openrouter,
      resolveModels("openrouter", options)
    ),
  };
}

/** Shared core: load images, resolve config, call orchestrator, format result. */
async function executeVision(
  imagePaths: string[],
  promptOverride: string | undefined,
  providersOverride: string | undefined,
  config: { defaultPrompt: string; providerOrder: ProviderId[] },
  registry: Record<ProviderId, VisionProvider>
): Promise<{ title: string; output: string; providerUsed: string; model: string }> {
  const images = await Promise.all(imagePaths.map(loadImageAsDataUri));
  const prompt = promptOverride || config.defaultPrompt;
  const order = resolveProviderOrder(providersOverride, config.providerOrder.join(","));
  const providers = order.map((id) => registry[id]);

  const result = await describeImageWithFallback(providers, images, prompt);

  return {
    title: `Vision: ${result.providerUsed} (${result.model})`,
    output: `**Vision model:** ${result.providerUsed} (${result.model})\n\n${result.text}`,
    providerUsed: result.providerUsed,
    model: result.model,
  };
}

function createPluginState(options?: OpenCodeSeePluginOptions) {
  const config = loadConfig(options);
  const registry = buildProviderRegistry(options);
  return { config, registry };
}

// ---------------------------------------------------------------------------
// V2 plugin (OpenCode V2) — via Plugin.define()
// ---------------------------------------------------------------------------

async function v2Setup(ctx: Context) {
  const pluginOpts = ctx.options as OpenCodeSeePluginOptions | undefined;
  const { config, registry } = createPluginState(pluginOpts);

  await ctx.tool.transform((editor) => {
    editor.add({
      name: "opencode_see",
      description: TOOL_DESCRIPTION,
      input: {
        type: "object",
        properties: {
          image: {
            type: "array",
            items: { type: "string" },
            description:
              "One or more local file paths (relative to project root or absolute) or http(s) URLs to images",
          },
          prompt: {
            type: "string",
            description:
              "What to focus on, e.g. 'describe the UI layout' or 'read the error text'. " +
              "Defaults to a general description.",
          },
          providers: {
            type: "string",
            description:
              "Optional comma-separated provider order override for this call only, e.g. 'cerebras,gemini'. " +
              "Valid ids: gemini, groq, cerebras, openrouter.",
          },
        },
        required: ["image"],
        additionalProperties: false,
      },
      async execute(input: unknown, _context: unknown) {
        const args = input as { image: string[]; prompt?: string; providers?: string };
        const result = await executeVision(
          args.image,
          args.prompt,
          args.providers,
          config,
          registry
        );
        return { content: result.output };
      },
    });
  });
}

// ---------------------------------------------------------------------------
// V1 plugin (OpenCode V1) — via server()
// ---------------------------------------------------------------------------

async function v1Server(
  _context: { directory: string; project?: unknown; client?: unknown },
  options?: Record<string, unknown>
) {
  const { tool } = await import("@opencode-ai/plugin");
  const pluginOpts = options as OpenCodeSeePluginOptions | undefined;
  const { config, registry } = createPluginState(pluginOpts);

  return {
    tool: {
      opencode_see: tool({
        description: TOOL_DESCRIPTION,
        args: {
          image: tool.schema
            .array(tool.schema.string())
            .describe(
              "One or more local file paths (relative to project root or absolute) or http(s) URLs to images"
            ),
          prompt: tool.schema
            .string()
            .optional()
            .describe(
              "What to focus on, e.g. 'describe the UI layout' or 'read the error text'. " +
                "Defaults to a general description."
            ),
          providers: tool.schema
            .string()
            .optional()
            .describe(
              "Optional comma-separated provider order override for this call only, e.g. 'cerebras,gemini'. " +
                "Valid ids: gemini, groq, cerebras."
            ),
        },
        async execute(
          args: { image: string[]; prompt?: string; providers?: string },
          _context: unknown
        ) {
          const result = await executeVision(
            args.image,
            args.prompt,
            args.providers,
            config,
            registry
          );
          return {
            title: result.title,
            output: result.output,
            metadata: { provider: result.providerUsed, model: result.model },
          };
        },
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// V2 export: Plugin.define()
// ---------------------------------------------------------------------------

export default Plugin.define({
  id: "opencode-see",
  setup: v2Setup,
});

// ---------------------------------------------------------------------------
// V1 export: server() function (named export for backward compat)
// ---------------------------------------------------------------------------

export { v1Server as server };
