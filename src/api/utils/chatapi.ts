import { action } from "~/routes/api.chat";

export async function generateChatResponse(request: Request, env: Env) {
  return await action({
    request,
    context: {
      cloudflare: {
        env,
      },
    },
  });
}
