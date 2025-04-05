// Helper to generate the layout
import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { marked } from "marked";
import type { AuthRequest } from "@cloudflare/workers-oauth-provider";
import { env } from "cloudflare:workers";

// This file mainly exists as a dumping ground for uninteresting html and CSS
// to remove clutter and noise from the auth logic. You likely do not need
// anything from this file.

export const layout = (
  content: HtmlEscapedString | string,
  title: string,
) => html`
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                primary: "#3498db",
                secondary: "#2ecc71",
                accent: "#f39c12",
              },
              fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
                heading: ["Roboto", "system-ui", "sans-serif"],
              },
            },
          },
        };
      </script>
      <style>
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap");

        /* Custom styling for markdown content */
        .markdown h1 {
          font-size: 2.25rem;
          font-weight: 700;
          font-family: "Roboto", system-ui, sans-serif;
          color: #1a202c;
          margin-bottom: 1rem;
          line-height: 1.2;
        }

        .markdown h2 {
          font-size: 1.5rem;
          font-weight: 600;
          font-family: "Roboto", system-ui, sans-serif;
          color: #2d3748;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          line-height: 1.3;
        }

        .markdown h3 {
          font-size: 1.25rem;
          font-weight: 600;
          font-family: "Roboto", system-ui, sans-serif;
          color: #2d3748;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }

        .markdown p {
          font-size: 1.125rem;
          color: #4a5568;
          margin-bottom: 1rem;
          line-height: 1.6;
        }

        .markdown a {
          color: #3498db;
          font-weight: 500;
          text-decoration: none;
        }

        .markdown a:hover {
          text-decoration: underline;
        }

        .markdown blockquote {
          border-left: 4px solid #f39c12;
          padding-left: 1rem;
          padding-top: 0.75rem;
          padding-bottom: 0.75rem;
          margin-top: 1.5rem;
          margin-bottom: 1.5rem;
          background-color: #fffbeb;
          font-style: italic;
        }

        .markdown blockquote p {
          margin-bottom: 0.25rem;
        }

        .markdown ul,
        .markdown ol {
          margin-top: 1rem;
          margin-bottom: 1rem;
          margin-left: 1.5rem;
          font-size: 1.125rem;
          color: #4a5568;
        }

        .markdown li {
          margin-bottom: 0.5rem;
        }

        .markdown ul li {
          list-style-type: disc;
        }

        .markdown ol li {
          list-style-type: decimal;
        }

        .markdown pre {
          background-color: #f7fafc;
          padding: 1rem;
          border-radius: 0.375rem;
          margin-top: 1rem;
          margin-bottom: 1rem;
          overflow-x: auto;
        }

        .markdown code {
          font-family: monospace;
          font-size: 0.875rem;
          background-color: #f7fafc;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
        }

        .markdown pre code {
          background-color: transparent;
          padding: 0;
        }
      </style>
    </head>
    <body
      class="bg-gray-50 text-gray-800 font-sans leading-relaxed flex flex-col min-h-screen"
    >
      <header class="bg-white shadow-sm mb-8">
        <div
          class="container mx-auto px-4 py-4 flex justify-between items-center"
        >
          <a
            href="/"
            class="text-xl font-heading font-bold text-primary hover:text-primary/80 transition-colors"
            >MCP Remote Auth Demo</a
          >
        </div>
      </header>
      <main class="container mx-auto px-4 pb-12 flex-grow">${content}</main>
      <footer class="bg-gray-100 py-6 mt-12">
        <div class="container mx-auto px-4 text-center text-gray-600">
          <p>
            &copy; ${new Date().getFullYear()} MCP Remote Auth Demo. All rights
            reserved.
          </p>
        </div>
      </footer>
    </body>
  </html>
`;

export const homeContent = async (req: Request): Promise<HtmlEscapedString> => {
  // We have the README symlinked into the static directory, so we can fetch it
  // and render it into HTML
  const origin = new URL(req.url).origin;
  const res = await env.ASSETS.fetch(`${origin}/README.md`);
  const markdown = await res.text();
  const content = await marked(markdown);
  return html` <div class="max-w-4xl mx-auto markdown">${raw(content)}</div> `;
};

export const renderLoggedInAuthorizeScreen = async (
  oauthScopes: { name: string; description: string }[],
  oauthReqInfo: AuthRequest,
) => {
  return html`
    <div class="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md">
      <h1 class="text-2xl font-heading font-bold mb-6 text-gray-900">
        Authorization Request
      </h1>

      <div class="mb-8">
        <h2 class="text-lg font-semibold mb-3 text-gray-800">
          MCP Remote Auth Demo would like permission to:
        </h2>
        <ul class="space-y-2">
          ${oauthScopes.map(
            (scope) => html`
              <li class="flex items-start">
                <span class="inline-block mr-2 mt-1 text-secondary">✓</span>
                <div>
                  <p class="font-medium">${scope.name}</p>
                  <p class="text-gray-600 text-sm">${scope.description}</p>
                </div>
              </li>
            `,
          )}
        </ul>
      </div>
      <form action="/approve" method="POST" class="space-y-4">
        <input
          type="hidden"
          name="oauthReqInfo"
          value="${JSON.stringify(oauthReqInfo)}"
        />
        <input type="hidden" name="email" value="user@example.com" />
        <button
          type="submit"
          name="action"
          value="approve"
          class="w-full py-3 px-4 bg-secondary text-white rounded-md font-medium hover:bg-secondary/90 transition-colors"
        >
          Approve
        </button>
        <button
          type="submit"
          name="action"
          value="reject"
          class="w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors"
        >
          Reject
        </button>
      </form>
    </div>
  `;
};

export const renderLoggedOutAuthorizeScreen = async (
  oauthScopes: { name: string; description: string }[],
  oauthReqInfo: AuthRequest,
) => {
  return html`
    <div class="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md">
      <h1 class="text-2xl font-heading font-bold mb-6 text-gray-900">
        Authorization Request
      </h1>

      <div class="mb-8">
        <h2 class="text-lg font-semibold mb-3 text-gray-800">
          MCP Remote Auth Demo would like permission to:
        </h2>
        <ul class="space-y-2">
          ${oauthScopes.map(
            (scope) => html`
              <li class="flex items-start">
                <span class="inline-block mr-2 mt-1 text-secondary">✓</span>
                <div>
                  <p class="font-medium">${scope.name}</p>
                  <p class="text-gray-600 text-sm">${scope.description}</p>
                </div>
              </li>
            `,
          )}
        </ul>
      </div>
      <form action="/approve" method="POST" class="space-y-4">
        <input
          type="hidden"
          name="oauthReqInfo"
          value="${JSON.stringify(oauthReqInfo)}"
        />
        <div class="space-y-4">
          <div>
            <label
              for="email"
              class="block text-sm font-medium text-gray-700 mb-1"
              >Email</label
            >
            <input
              type="email"
              id="email"
              name="email"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>
          <div>
            <label
              for="password"
              class="block text-sm font-medium text-gray-700 mb-1"
              >Password</label
            >
            <input
              type="password"
              id="password"
              name="password"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>
        </div>
        <button
          type="submit"
          name="action"
          value="login_approve"
          class="w-full py-3 px-4 bg-primary text-white rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          Log in and Approve
        </button>
        <button
          type="submit"
          name="action"
          value="reject"
          class="w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors"
        >
          Reject
        </button>
      </form>
    </div>
  `;
};

export const renderApproveContent = async (
  message: string,
  status: string,
  redirectUrl: string,
) => {
  return html`
    <div class="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md text-center">
      <div class="mb-4">
        <span
          class="inline-block p-3 ${status === "success"
            ? "bg-green-100 text-green-800"
            : "bg-red-100 text-red-800"} rounded-full"
        >
          ${status === "success" ? "✓" : "✗"}
        </span>
      </div>
      <h1 class="text-2xl font-heading font-bold mb-4 text-gray-900">
        ${message}
      </h1>
      <p class="mb-8 text-gray-600">
        You will be redirected back to the application shortly.
      </p>
      <a
        href="/"
        class="inline-block py-2 px-4 bg-primary text-white rounded-md font-medium hover:bg-primary/90 transition-colors"
      >
        Return to Home
      </a>
      ${raw(`
				<script>
					setTimeout(() => {
						window.location.href = "${redirectUrl}";
					}, 2000);
				</script>
			`)}
    </div>
  `;
};

export const renderAuthorizationApprovedContent = async (
  redirectUrl: string,
) => {
  return renderApproveContent(
    "Authorization approved!",
    "success",
    redirectUrl,
  );
};

export const renderAuthorizationRejectedContent = async (
  redirectUrl: string,
) => {
  return renderApproveContent("Authorization rejected.", "error", redirectUrl);
};

export const parseApproveFormBody = async (body: {
  [x: string]: string | File;
}) => {
  const action = body.action as string;
  const email = body.email as string;
  const password = body.password as string;
  let oauthReqInfo: AuthRequest | null = null;
  try {
    oauthReqInfo = JSON.parse(body.oauthReqInfo as string) as AuthRequest;
  } catch (e) {
    oauthReqInfo = null;
  }

  return { action, oauthReqInfo, email, password };
};
