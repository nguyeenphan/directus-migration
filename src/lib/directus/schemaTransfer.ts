import type { SchemaDiffOutput, SchemaSnapshotOutput } from '@directus/sdk';
import { customEndpoint } from '@directus/sdk';

/**
 * A schema of any real size is bigger than the target's JSON body limit
 * (MAX_PAYLOAD_SIZE, 1mb unless raised), and it cannot be sent in pieces.
 * Both schema endpoints also take the document as an uploaded file, which
 * that limit does not apply to — so that is how it always travels.
 */
const asFile = (document: unknown) => {
  const form = new FormData();

  form.append(
    'file',
    new Blob([JSON.stringify(document)], { type: 'application/json' }),
    'schema.json',
  );

  return form;
};

// The SDK deletes this placeholder so fetch can set the real header, boundary
// and all — and it deletes it from the object it is given, so every request
// needs a fresh one. A shared constant works exactly once.
const multipart = () => ({ 'Content-Type': 'multipart/form-data' });

export const diffSchema = (snapshot: SchemaSnapshotOutput, force: boolean) =>
  customEndpoint<SchemaDiffOutput>({
    path: '/schema/diff',
    method: 'POST',
    params: force ? { force: true } : {},
    body: asFile(snapshot),
    headers: multipart(),
  });

export const applySchema = (diff: SchemaDiffOutput) =>
  customEndpoint<void>({
    path: '/schema/apply',
    method: 'POST',
    body: asFile(diff),
    headers: multipart(),
  });
