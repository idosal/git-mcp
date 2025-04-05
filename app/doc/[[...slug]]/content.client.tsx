"use client";

import { useEffect, useState, useMemo } from "react";
import { getRepoData, RepoData } from "../../../shared/repoData";
import Content from "./content";
import { removeLeadingUnderscore } from "../../../shared/urlUtils";

/**
 * This component is used when we can't get the full request URL from the headers
 */
export default function ContentClient() {
  const [locationHref, setLocationHref] = useState("");
  useEffect(() => {
    const locationHref = window.location.href;
    setLocationHref(locationHref);
  }, []);

  const { urlType, owner, repo, url } = useMemo<
    RepoData & { url?: string }
  >(() => {
    if (!locationHref) {
      return {
        urlType: "unknown",
        owner: null,
        repo: null,
        host: "gitmcp.io",
      };
    }
    const locationWithoutUnderscore = removeLeadingUnderscore(locationHref);
    const locationObj = new URL(locationWithoutUnderscore);
    const host = locationObj.host;
    let pathname = locationObj.pathname;
    const repoData = getRepoData({ requestHost: host, requestUrl: pathname });
    return { ...repoData, url: locationObj.toString() };
  }, [locationHref]);
  return locationHref ? (
    <Content urlType={urlType} owner={owner} repo={repo} url={url} />
  ) : null;
}
