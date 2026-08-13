import { tool, type Plugin, type PluginOptions } from "@opencode-ai/plugin";
import { loadImageAsDataUri } from "./image.js";
import {
  loadConfig,
  resolveModels,
  resolveProviderOrder,
  type DescribeImagePluginOptions,
  type ProviderId,
} from "./config.js";
import { describeImageWithFallback } from "./orchestrator.js";
import { GeminiProvider } from "./providers/gemini.js";
import { GroqProvider } from "./providers/groq.js";
import { CerebrasProvider } from "./providers/cerebras.js";
import type { VisionProvider } from "./providers/types.js";

function buildProviderRegistry(
  options?: DescribeImagePluginOptions
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
  };
}

export const DescribeImagePlugin: Plugin = async (
  { directory },
  options?: PluginOptions
) => {
  const config = loadConfig(options as DescribeImagePluginOptions | undefined);
  const registry = buildProviderRegistry(options as DescribeImagePluginOptions | undefined);

  return {
    tool: {
      describe_image: tool({
        description:
          "Get a text description of one or more images (local file paths or http(s) URLs) from a vision model. " +
          "Tries providers one at a time in order (Gemini, then Groq, then Cerebras by default), " +
          "trying each provider's models in order, and returns the first successful description.",
        args: {
          image: tool.schema
            .array(tool.schema.string())
            .describe("One or more local file paths (relative to project root or absolute) or http(s) URLs to images"),
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
        async execute(args, _context) {
          const images = await Promise.all(args.image.map(loadImageAsDataUri));
          const prompt = args.prompt || config.defaultPrompt;
          const order = resolveProviderOrder(args.providers, config.providerOrder.join(","));
          const providers = order.map((id) => registry[id]);

          const result = await describeImageWithFallback(providers, images, prompt);

          return `${result.text}\n\n_(described by ${result.providerUsed}: ${result.model})_`;
        },
      }),
    },
  };
};

export default DescribeImagePlugin;
