import { getRepoData } from "../../src/shared/repoData";
import Content from "../components/content";
import ChatPageServer from "../components/chatPage";

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
  const isValid = (owner && repo) || (!owner && repo == "docs");
  // is a chat page
  return isValid && owner != "chat" && repo != "chat" && url.endsWith("/chat");
}
