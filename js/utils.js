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

/** Dispatch a namespaced CustomEvent on document. */
export function dispatch(name, detail = null) {
  document.dispatchEvent(new CustomEvent(name, detail ? { detail } : undefined));
}

/**
 * Parse a YouTube video title into artist and song title.
 *
 * Expects the common tab/cover format: "Artist - Song Title (noise) [noise]"
 * Splits on the first " - " (or en-dash), then strips trailing parenthetical
 * and bracketed blocks and pipe-separated suffixes from the song title.
 * Returns { artist, title } where artist is null if no separator was found.
 *
 * @param {string} rawTitle
 * @returns {{ artist: string|null, title: string }}
 */
export function parseVideoTitle(rawTitle) {
  function clean(str) {
    let s = str.replace(/\s*\|.*$/, '').trim();  // strip " | anything"
    let prev;
    do {
      prev = s;
      s = s.replace(/\s*\([^)]*\)\s*$/, '').trim();  // strip trailing (...)
      s = s.replace(/\s*\[[^\]]*\]\s*$/, '').trim();  // strip trailing [...]
    } while (s !== prev);
    return s;
  }

  const match = rawTitle.match(/^(.+?)\s[-–—]\s(.+)$/);
  if (!match) return { artist: null, title: clean(rawTitle) };
  return { artist: clean(match[1]), title: clean(match[2]) };
}

/**
 * Fetch and parse video metadata from YouTube oEmbed.
 * Returns { title, artist } where artist is '' when the title contains no
 * "Artist - Song" separator. The YouTube channel name is never used as artist.
 * Returns null on failure.
 *
 * @param {string} videoUrl
 * @returns {Promise<{title: string, artist: string}|null>}
 */
export async function fetchOEmbed(videoUrl) {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = parseVideoTitle(data.title ?? '');
    return { title: parsed.title, artist: parsed.artist ?? '' };
  } catch {
    return null;
  }
}
