import React from "react";
import { getRepoData } from "../../../shared/repoData";
import Content from "./content";
import { headers } from "next/headers";
import ContentClient from "./content.client";
import { removeLeadingUnderscore } from "../../../shared/urlUtils";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const headersList = await headers();
  const { slug }: { slug: string[] } = await params;

  const cleanUrl = getCleanUrl(headersList, slug);

  if (!cleanUrl) {
    console.error("No clean URL found, falling back to client resolution");
    return <ContentClient />;
  }

  const host = cleanUrl.host;
  const pathname = cleanUrl.pathname;

  const { urlType, owner, repo } = getRepoData({
    requestHost: host,
    requestUrl: pathname,
  });

  return (
    <Content
      urlType={urlType}
      owner={owner}
      repo={repo}
      url={cleanUrl.toString()}
    />
  );
}

function getCleanUrl(headersList: Headers, slug: string[]): URL | null {
  try {
    const referer = headersList.get("referer");
    if (referer) {
      const refererUrlWithoutUnderscore = removeLeadingUnderscore(referer);
      return new URL(refererUrlWithoutUnderscore);
    } else {
      const forwardedHostHeader = headersList.get("x-forwarded-host");
      const forwardedProtocolHeader = headersList.get("x-forwarded-proto");
      const hostHeader = headersList.get("host");

      if (forwardedHostHeader && forwardedProtocolHeader) {
        return new URL(
          `${forwardedProtocolHeader}://${forwardedHostHeader}/${slug.join("/")}`,
        );
      } else {
        const protocol = hostHeader?.includes("localhost") ? "http" : "https";
        return new URL(`${protocol}://${hostHeader}/${slug.join("/")}`);
      }
    }
  } catch (err) {
    console.error(err);
    return null;
  }
}
