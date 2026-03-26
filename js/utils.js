// ── Utility functions ──

/** Generate a random UUID (crypto.randomUUID where available, fallback otherwise) */
export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/** Extract an 11-character YouTube video ID from a URL, or return null */
export function extractVideoId(url) {
  const m = url.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
  );
  return m ? m[1] : null;
}

/**
 * Fetch video title and author from YouTube oEmbed.
 * Returns { title, author } or null on failure.
 */
export async function fetchOEmbed(videoUrl) {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.title ?? '', author: data.author_name ?? '' };
  } catch {
    return null;
  }
}
