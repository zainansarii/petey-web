/** Only a configured Google Form responder URL may receive trainer applicants. */
export function trainerApplicationUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.hostname !== "docs.google.com"
      || url.username || url.password || url.port
      || !/^\/forms\/d\/(?:e\/)?[a-zA-Z0-9_-]+\/viewform$/.test(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
}
