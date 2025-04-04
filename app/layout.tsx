import "./globals.css";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";

// Initialize the Inter font
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "GitMCP",
  description: "Instantly create an MCP server for any GitHub project",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <head>
        <link rel="icon" href="/icon_black_cropped.png" />
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
        <meta property="og:image" content="https://gitmcp.io/OG.png" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta property="twitter:domain" content="gitmcp.io" />
        <meta property="twitter:url" content="https://gitmcp.io/" />
        <meta name="twitter:title" content="GitMCP" />
        <meta
          name="twitter:description"
          content="Instantly create an MCP server for any GitHub project"
        />
        <meta name="twitter:image" content="https://gitmcp.io/OG." />
        <Analytics />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
