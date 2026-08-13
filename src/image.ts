import { readFile } from "node:fs/promises";
import { ImagePayload } from "./providers/types.js";

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function guessMimeType(pathOrUrl: string): string {
  const ext = pathOrUrl.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] || "image/png";
}

/**
 * Loads an image from a local file path or an http(s) URL and returns
 * it as a base64 data URI, ready to hand to any provider.
 */
export async function loadImageAsDataUri(pathOrUrl: string): Promise<ImagePayload> {
  const isUrl = /^https?:\/\//i.test(pathOrUrl);
  const mimeType = guessMimeType(pathOrUrl);

  let bytes: Uint8Array;
  if (isUrl) {
    const res = await fetch(pathOrUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch image URL (HTTP ${res.status}): ${pathOrUrl}`);
    }
    bytes = new Uint8Array(await res.arrayBuffer());
  } else {
    try {
      bytes = await readFile(pathOrUrl);
    } catch (err) {
      throw new Error(`Failed to read local image file: ${pathOrUrl} (${(err as Error).message})`);
    }
  }

  const base64 = Buffer.from(bytes).toString("base64");
  return {
    dataUri: `data:${mimeType};base64,${base64}`,
    mimeType,
  };
}
