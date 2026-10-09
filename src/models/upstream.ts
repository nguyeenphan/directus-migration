import { DIRECTUS_URL_PARAM } from '@/constants/directus';
import { withoutTrailingSlash } from '@/utils/url';

export const resolveUpstream = (
  raw: string | null,
  allowedHosts: string[],
): URL => {
  if (!raw) throw new Error('Missing upstream URL');

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Not a valid URL: ${raw}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${url.protocol}`);
  }

  if (allowedHosts.length > 0 && !allowedHosts.includes(url.host)) {
    throw new Error(`Host not allowed: ${url.host}`);
  }

  return url;
};

export const upstreamTarget = (
  upstream: URL,
  path: string[],
  search: URLSearchParams,
): URL => {
  const target = new URL(upstream);
  target.pathname = `${withoutTrailingSlash(upstream.pathname)}/${path.join('/')}`;

  for (const [key, value] of search) {
    if (key !== DIRECTUS_URL_PARAM) target.searchParams.append(key, value);
  }

  return target;
};

const SAFE_METHODS = ['GET', 'HEAD'];

/**
 * A host listed as read-only never receives a write through the proxy, no
 * matter what the browser asks for — the guarantee that a production source
 * stays untouched does not rest on every caller being right.
 */
export const refusesWrite = (
  upstream: URL,
  method: string,
  readOnlyHosts: string[],
) =>
  readOnlyHosts.includes(upstream.host) &&
  !SAFE_METHODS.includes(method.toUpperCase());
