import { getRepoData } from "../../src/shared/repoData";
import Content from "../components/content";
import ChatPageServer from "../components/chatPage";
import type { MetaFunction } from "react-router";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [];
  }
  const { owner, repo, url } = data;
  const repoDescription = repo ? `${owner}/${repo}` : "any GitHub repo";
  if (isChatPage({ owner, repo, url })) {
    return [
      { title: "GitMCP Chat" },
      {
        name: "description",
        content: `Chat with the documentation for ${repoDescription}`,
      },
    ];
  }
  return [
    { title: `GitMCP` },
    {
      name: "description",
      content: `Get the documentation for ${repoDescription}`,
    },
  ];
};

export const loader = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const host = url.host;
  const pathname = url.pathname;

  const { urlType, owner, repo } = getRepoData({
    requestHost: host,
    requestUrl: pathname,
  });

  return { urlType, owner, repo, url: url.toString() };
};

export function HydrateFallback() {
  return <p>Skeleton rendered during SSR</p>; // (2)
}

export default function ContentPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { urlType, owner, repo, url } = loaderData;

  if (isChatPage({ owner, repo, url })) {
    return <ChatPageServer owner={owner} repo={repo} />;
  }

  return <Content urlType={urlType} owner={owner} repo={repo} url={url} />;
}

function isChatPage({
  owner,
  repo,
  url,
}: {
  owner: string | null;
  repo: string | null;
  url: string;
}) {
  // is a valid repo
  const isValid = (owner && repo) || (!repo && owner == "docs");
  if (!isValid) {
    return false;
  }
  // is a chat page
  return owner != "chat" && repo != "chat" && url.endsWith("/chat");
}
