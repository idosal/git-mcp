import type { RepoData, UrlType } from "../../../shared/repoData.js";
import type { RepoHandler } from "./RepoHandler.js";
import { getDefaultRepoHandler } from "./DefaultRepoHandler.js";
import { getGenericRepoHandler } from "./GenericRepoHandler.js";
import { getThreejsRepoHandler } from "./ThreejsRepoHandler.js";
import { getReactRouterRepoHandler } from "./ReactRouterRepoHandler.js";

const handlers: RepoHandlerMap = {
  // handle all types of urls for three.js
  "all::mrdoob/three.js": getThreejsRepoHandler(),
  // handle only the github type of urls for "generic" repos
  "all::docs/": getGenericRepoHandler(),
  "all::remix-run/react-router": getReactRouterRepoHandler(),
};

export function getHandlerByRepoData(repoData: RepoData): RepoHandler {
  if (!repoData.repo && repoData.owner !== "docs") {
    console.log("Invalid repo data:", repoData);

    throw new Error(
      `Invalid repository data: ${JSON.stringify(repoData, null, 2)}`,
    );
  }

  const repoKey = `${repoData.owner ?? ""}/${repoData.repo ?? ""}` as RepoKey;

  return (
    // check if the keyWithUrlType is in the handlers
    handlers[`${repoData.urlType}::${repoKey}` as UrlTypeRepoKey] ??
    // check if the allKey is in the handlers
    handlers[`all::${repoKey}` as AllRepoKey] ??
    // if not, return the default handler
    getDefaultRepoHandler()
  );
}

type RepoKey = `${string}/${string}`;
type UrlTypeRepoKey = `${UrlType}::${RepoKey}`;
type AllRepoKey = `all::${RepoKey}`;
type MapRepoKey = UrlTypeRepoKey | AllRepoKey;

type RepoHandlerMap = {
  [key in MapRepoKey]: RepoHandler;
};
