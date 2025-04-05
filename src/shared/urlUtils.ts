export function removeLeadingUnderscore(url: string) {
  const urlObj = new URL(url);
  let pathname = urlObj.pathname;
  // remove leading /_/
  pathname = pathname.slice(2);
  const urlObjWithoutLeadingUnderscore = new URL(pathname, urlObj.origin);
  return urlObjWithoutLeadingUnderscore.toString();
}
