import "./globals.css";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export default function App() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/img/icon_black_cropped.png" />
        <title>GitMCP</title>
        <meta
          name="description"
          content="Instantly create an MCP server for any GitHub project"
        />

        <meta property="og:url" content="https://gitmcp.io/" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="GitMCP" />
        <meta
          property="og:description"
          content="Instantly create an MCP server for any GitHub project"
        />
        <meta property="og:image" content="https://gitmcp.io/img/OG.png" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta property="twitter:domain" content="gitmcp.io" />
        <meta property="twitter:url" content="https://gitmcp.io/" />
        <meta name="twitter:title" content="GitMCP" />
        <meta
          name="twitter:description"
          content="Instantly create an MCP server for any GitHub project"
        />
        <meta name="twitter:image" content="https://gitmcp.io/img/OG.png" />
        {/* All `meta` exports on all routes will render here */}
        <Meta />

        {/* All `link` exports on all routes will render here */}
        <Links />
      </head>
      <body className="font-sans antialiased">
        {/* Child routes render here */}
        <Outlet />

        {/* Manages scroll position for client-side transitions */}
        {/* If you use a nonce-based content security policy for scripts, you must provide the `nonce` prop. Otherwise, omit the nonce prop as shown here. */}
        <ScrollRestoration />

        {/* Script tags go here */}
        {/* If you use a nonce-based content security policy for scripts, you must provide the `nonce` prop. Otherwise, omit the nonce prop as shown here. */}
        <Scripts />
      </body>
    </html>
  );
}
