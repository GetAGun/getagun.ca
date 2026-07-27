import { describe, expect, it } from 'vitest';
import { requireAccess } from './access';
import type { Env } from './index';

const req = (headers: Record<string, string> = {}) =>
  new Request('https://getagun.ca/api/admin/retailers', { headers });
const env = (over: Partial<Env> = {}) => ({ ...over }) as Env;

describe('requireAccess', () => {
  it('fails closed when Access config is missing', async () => {
    expect(await requireAccess(req(), env())).toBe(false);
    expect(await requireAccess(req(), env({ ACCESS_TEAM_DOMAIN: 'x.cloudflareaccess.com' }))).toBe(false);
    expect(await requireAccess(req(), env({ ACCESS_AUD: 'aud' }))).toBe(false);
  });
  it('rejects a configured env with no JWT header', async () => {
    expect(await requireAccess(req(), env({ ACCESS_TEAM_DOMAIN: 'x.cloudflareaccess.com', ACCESS_AUD: 'aud' }))).toBe(false);
  });
  it('allows only the explicit dev bypass', async () => {
    expect(await requireAccess(req(), env({ DEV_SKIP_ACCESS: '1' }))).toBe(true);
    expect(await requireAccess(req(), env({ DEV_SKIP_ACCESS: '0' }))).toBe(false);
  });
});
