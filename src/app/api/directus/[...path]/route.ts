import { type NextRequest, NextResponse } from 'next/server';

import {
  DIRECTUS_UPSTREAM_HEADER,
  DIRECTUS_URL_HEADER,
  DIRECTUS_URL_PARAM,
} from '@/api';
import { resolveUpstream, upstreamTarget } from '@/models/upstream';

const ALLOWED_HOSTS = (process.env.DIRECTUS_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const LOG_BODY_LIMIT = 2000;

const describeNetworkError = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);

  const parts: string[] = [error.message];

  for (
    let cause: unknown = error.cause;
    cause instanceof Error;
    cause = cause.cause
  ) {
    const code = (cause as { code?: string }).code;
    parts.push(code ? `${code}: ${cause.message}` : cause.message);
  }

  return (parts.length > 1 ? parts.slice(1) : parts).join(' → ');
};

const clip = (text: string) =>
  text.length > LOG_BODY_LIMIT ? `${text.slice(0, LOG_BODY_LIMIT)}…` : text;

const FORWARDED_HEADERS = ['authorization', 'content-type', 'accept'];

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;

  let upstream: URL;
  try {
    upstream = resolveUpstream(
      request.headers.get(DIRECTUS_URL_HEADER) ??
        request.nextUrl.searchParams.get(DIRECTUS_URL_PARAM),
      ALLOWED_HOSTS,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(
      `[directus] rejected ${request.method} /${path.join('/')} — ${detail}`,
    );
    return NextResponse.json(
      { errors: [{ message: detail }] },
      { status: 400 },
    );
  }

  const target = upstreamTarget(upstream, path, request.nextUrl.searchParams);

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();

  const label = `${request.method} ${target.pathname}`;
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch (error) {
    const detail = describeNetworkError(error);
    console.error(
      `[directus] ${label} → unreachable (${upstream.host}) — ${detail}`,
    );
    return NextResponse.json(
      { errors: [{ message: `Cannot reach ${upstream.host}: ${detail}` }] },
      { status: 502 },
    );
  }

  const ms = Date.now() - startedAt;
  const line = `[directus] ${label} → ${response.status} ${ms}ms (${upstream.host})`;

  if (!response.ok) {
    const text = await response.text();
    console.error(line);
    if (body && body.byteLength > 0) {
      console.error(
        `[directus]   payload: ${clip(new TextDecoder().decode(body))}`,
      );
    }
    console.error(`[directus]   response: ${clip(text)}`);

    return new NextResponse(text, {
      status: response.status,
      headers: {
        'content-type':
          response.headers.get('content-type') ?? 'application/json',
        [DIRECTUS_UPSTREAM_HEADER]: target.toString(),
      },
    });
  }

  console.info(line);

  const out = new Headers(response.headers);
  out.delete('content-encoding');
  out.delete('content-length');

  out.delete('set-cookie');
  out.set(DIRECTUS_UPSTREAM_HEADER, target.toString());

  return new NextResponse(response.body, {
    status: response.status,
    headers: out,
  });
}

export const GET = forward;
export const HEAD = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
