const BASE_URL = "https://pub-bc322911983247f9b0d27df5f33e0932.r2.dev";

export async function fetchFileFromR2(
  owner: string,
  repo: string,
  filename: string,
) {
  if (owner && repo) {
    const urlParts = [owner, repo, filename];
    const url = new URL(urlParts.join("/"), BASE_URL);
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      console.log("Failed to fetch from r2", error);
    }
  }
  return null;
}
