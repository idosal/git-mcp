export interface TestSetupBindings extends Env {
  DOCS_BUCKET: R2Bucket; // Ensure this matches CloudflareEnvironment definition
  ENVIRONMENT?: string; // Environment variable to check if we are in 'test' mode
}

const dummyFilesToUpload = [
  {
    bucketPath: "remix-run/react-router/llms.txt",
    content:
      "# React Router Dummy Test File\n\nThis is hardcoded content for E2E testing R2 population.",
  },
  {
    bucketPath: "answerdotai/fasthtml/llms.txt",
    content:
      "# FastHTML Dummy Test File\n\nThis is hardcoded content for E2E testing R2 population.",
  },
  {
    bucketPath: "mrdoob/three.js/llms.txt",
    content:
      "# Three.js Dummy Test File\n\nThis is hardcoded content for E2E testing R2 population.",
  },
];

export async function handleR2TestSetup(
  env: TestSetupBindings,
): Promise<Response> {
  if (env.ENVIRONMENT !== "test") {
    console.warn("Attempted to run R2 setup outside test environment.");
    return new Response("Forbidden", {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("Handling R2 setup for tests using hardcoded content...");

  if (!env.DOCS_BUCKET) {
    console.error("DOCS_BUCKET binding not found in environment.");
    return new Response(
      JSON.stringify({ error: "R2 bucket binding not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const results = [];
  let errors = 0;

  for (const file of dummyFilesToUpload) {
    try {
      await env.DOCS_BUCKET.put(file.bucketPath, file.content);
      results.push(
        `Successfully uploaded hardcoded content to ${file.bucketPath}`,
      );
      console.log(`Uploaded hardcoded content to ${file.bucketPath} in R2`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Error uploading hardcoded content to ${file.bucketPath} in R2:`,
        errorMessage,
      );
      results.push(
        `Failed to upload hardcoded content to ${file.bucketPath}: ${errorMessage}`,
      );
      errors++;
    }
  }

  const responseBody = {
    message:
      errors > 0
        ? `R2 setup partially failed. ${errors} errors.`
        : "R2 setup with hardcoded content successful.",
    details: results,
  };
  const status = errors > 0 ? 500 : 200;

  return new Response(JSON.stringify(responseBody), {
    status: status,
    headers: { "Content-Type": "application/json" },
  });
}
