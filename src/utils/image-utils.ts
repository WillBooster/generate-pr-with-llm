import fetch from 'node-fetch';

/** Extract all src URLs from <img> tags in HTML */
export function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  const re = /<img[^>]+src="([^"]+)"/g;
  for (const match of html.matchAll(re)) {
    urls.push(match[1]);
  }
  return [...new Set(urls)];
}

/** Download an image and return a Data URL */
export async function downloadImageAsDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const mime = res.headers.get('content-type') || 'application/octet-stream';
  const b64 = Buffer.from(buf).toString('base64');
  return `data:${mime};base64,${b64}`;
}
