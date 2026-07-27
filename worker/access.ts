import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from './index';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

// Cloudflare Access sits in front of /admin and /api/admin/* at the zone level;
// this verifies the JWT it injects so the API stays closed even if Access is misconfigured.
export async function requireAccess(request: Request, env: Env): Promise<boolean> {
  if (env.DEV_SKIP_ACCESS === '1') return true; // local dev only — set in .dev.vars, never in wrangler.jsonc vars
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return false; // fail closed on missing config
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return false;
  jwks ??= createRemoteJWKSet(new URL(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`));
  try {
    await jwtVerify(token, jwks, {
      audience: env.ACCESS_AUD,
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
    });
    return true;
  } catch {
    return false;
  }
}
