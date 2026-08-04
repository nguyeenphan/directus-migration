export type TVersionDrift = 'same' | 'patch' | 'major' | 'unknown';

const parse = (version: string) => {
  const [major, minor, patch] = version
    .trim()
    .split('.')
    .map((part) => parseInt(part, 10));

  if (![major, minor, patch].every(Number.isInteger)) return null;

  return { major, minor, patch };
};

export const compareVersions = (
  a: string | null,
  b: string | null,
): TVersionDrift => {
  if (!a || !b) return 'unknown';

  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return a === b ? 'same' : 'unknown';

  if (left.major !== right.major || left.minor !== right.minor) return 'major';
  if (left.patch !== right.patch) return 'patch';

  return 'same';
};

export const isDriftPassable = (drift: TVersionDrift) =>
  drift === 'same' || drift === 'patch';
