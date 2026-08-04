import {
  API_PROXY_URL,
  apiAssetUrl,
  DIRECTUS_URL_PARAM,
  THUMBNAIL_SIZE,
} from '@/api';
import { withoutTrailingSlash } from '@/utils/url';

export type TConnection = {
  url: string;
  token: string;
};

export type TSide = 'source' | 'target';

export const emptyConnection = (): TConnection => ({ url: '', token: '' });

export const isFilledIn = (connection: TConnection) =>
  connection.url.trim().length > 0 && connection.token.trim().length > 0;

export const fingerprintOf = (source: TConnection, target: TConnection) =>
  [source.url, source.token, target.url, target.token].join('|');

export const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export const parseConnection = (value: unknown): TConnection => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Missing connection');
  }

  const { url, token } = value as Record<string, unknown>;

  if (typeof url !== 'string' || typeof token !== 'string' || !token) {
    throw new Error('Missing URL or token');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Not a valid URL: ${url}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }

  return {
    url: parsed.origin + withoutTrailingSlash(parsed.pathname),
    token,
  };
};

export const assetThumbnailUrl = (connection: TConnection, id: string) => {
  const query = new URLSearchParams({
    width: String(THUMBNAIL_SIZE),
    height: String(THUMBNAIL_SIZE),
    fit: 'cover',
    access_token: connection.token,
    [DIRECTUS_URL_PARAM]: connection.url,
  });

  return `${API_PROXY_URL}${apiAssetUrl(id)}?${query}`;
};
