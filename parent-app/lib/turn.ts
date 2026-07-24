/** Build resilient TURN endpoints from one provisioned TURN URL. */
export function expandTurnUrls(configuredUrl: string): string[] {
  const primary = configuredUrl.trim();
  if (!primary) return [];

  const match = primary.match(/^turns?:([^:?/]+)(?::\d+)?/i);
  if (!match) return [primary];

  const host = match[1];
  return Array.from(new Set([
    primary,
    `turn:${host}:80`,
    `turn:${host}:80?transport=tcp`,
    `turn:${host}:443`,
    `turn:${host}:443?transport=tcp`,
    `turns:${host}:443?transport=tcp`,
  ]));
}