import type { NextApiRequest } from "next";
import { Readable } from "stream";

/**
 * Parse the raw body from a Next.js API request
 */
export async function parseRawBody(req: NextApiRequest): Promise<Buffer> {
  if (!(req.body instanceof Readable) && typeof req.body !== "undefined") {
    // Body already parsed, convert back to buffer
    return Buffer.from(JSON.stringify(req.body));
  }

  return new Promise((resolve, reject) => {
    const bodyParts: Buffer[] = [];

    req.on("data", (chunk) => {
      bodyParts.push(Buffer.from(chunk));
    });

    req.on("end", () => {
      resolve(Buffer.concat(bodyParts));
    });

    req.on("error", reject);
  });
}
