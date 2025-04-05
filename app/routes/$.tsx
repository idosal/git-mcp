import { getRepoData } from "../../src/shared/repoData";
import Content from "../components/content";

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

export default function ContentPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { urlType, owner, repo, url } = loaderData;

  return <Content urlType={urlType} owner={owner} repo={repo} url={url} />;
}
