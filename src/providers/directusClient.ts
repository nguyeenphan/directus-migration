import { createDirectus, rest, staticToken } from '@directus/sdk';

import { API_PROXY_URL, DIRECTUS_URL_HEADER } from '@/api';
import type { TConnection } from '@/models/connection';

export const clientFor = ({ url, token }: TConnection) =>
  createDirectus(`${window.location.origin}${API_PROXY_URL}`)
    .with(staticToken(token))
    .with(
      rest({
        onRequest: (options) => {
          const headers = new Headers(options.headers);
          headers.set(DIRECTUS_URL_HEADER, url);
          return { ...options, headers };
        },
      }),
    );

export type TDirectusClient = ReturnType<typeof clientFor>;
