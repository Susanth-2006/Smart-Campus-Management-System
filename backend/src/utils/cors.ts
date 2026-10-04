/**
 * CLIENT_ORIGIN is a comma-separated list of allowed frontend origins.
 * An entry may contain `*` as a wildcard for one hostname part, e.g. https://smart-campus-*.vercel.app (Vercel preview URLs).
 */
export function originMatcher(list: string): (origin: string) => boolean {
  const rules = list.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean).map((o) => {
    if (!o.includes('*')) return (origin: string) => origin === o;
    const re = new RegExp('^' + o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+') + '$', 'i');
    return (origin: string) => re.test(origin);
  });
  return (origin) => rules.some((r) => r(origin));
}
