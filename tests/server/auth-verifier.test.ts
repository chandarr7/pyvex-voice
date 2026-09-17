/**
 * Token verification: what the API accepts as proof of identity.
 *
 * Tokens are minted locally with a test key, so these run without a Supabase
 * project and without the network.
 */
import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';

import { createSupabaseVerifier } from '../../server/auth.js';

const PROJECT_URL = 'https://project.supabase.co';
const ISSUER = `${PROJECT_URL}/auth/v1`;
const SECRET = 'a-test-signing-secret-that-is-long-enough-for-hs256';
const key = new TextEncoder().encode(SECRET);

const env = { SUPABASE_URL: PROJECT_URL, SUPABASE_JWT_SECRET: SECRET } as NodeJS.ProcessEnv;

interface TokenOptions {
  sub?: string;
  role?: string;
  audience?: string;
  issuer?: string;
  email?: string;
  expiresIn?: string;
  signingKey?: Uint8Array;
}

function mintToken(options: TokenOptions = {}): Promise<string> {
  const {
    sub = '11111111-1111-4111-8111-111111111111',
    role = 'authenticated',
    audience = 'authenticated',
    issuer = ISSUER,
    email = 'alice@example.test',
    expiresIn = '1h',
    signingKey = key,
  } = options;

  return new SignJWT({ role, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(signingKey);
}

describe('createSupabaseVerifier', () => {
  it('returns null when no project is configured, so the API fails closed', async () => {
    expect(await createSupabaseVerifier({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('accepts a well-formed end-user token', async () => {
    const verify = await createSupabaseVerifier(env);
    const user = await verify!(await mintToken());

    expect(user.uid).toBe('11111111-1111-4111-8111-111111111111');
    expect(user.email).toBe('alice@example.test');
  });

  it('tolerates a trailing slash on the configured URL', async () => {
    const verify = await createSupabaseVerifier({
      ...env,
      SUPABASE_URL: `${PROJECT_URL}/`,
    } as NodeJS.ProcessEnv);
    await expect(verify!(await mintToken())).resolves.toMatchObject({ uid: expect.any(String) });
  });

  const rejections: Array<[string, TokenOptions]> = [
    ['signed with the wrong key', { signingKey: new TextEncoder().encode('a-completely-different-secret-value-here') }],
    ['issued by another project', { issuer: 'https://other.supabase.co/auth/v1' }],
    ['carrying the wrong audience', { audience: 'anon' }],
    ['already expired', { expiresIn: '-5m' }],
  ];

  for (const [label, options] of rejections) {
    it(`rejects a token ${label}`, async () => {
      const verify = await createSupabaseVerifier(env);
      await expect(verify!(await mintToken(options))).rejects.toThrow();
    });
  }

  it('rejects a service-role token presented as a user', async () => {
    // A leaked service-role key is a valid JWT for this project. Accepting one
    // here would let it act as any account.
    const verify = await createSupabaseVerifier(env);
    await expect(verify!(await mintToken({ role: 'service_role' }))).rejects.toThrow();
  });

  it('rejects a token with no subject', async () => {
    const verify = await createSupabaseVerifier(env);
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(key);

    await expect(verify!(token)).rejects.toThrow();
  });

  it('rejects malformed input', async () => {
    const verify = await createSupabaseVerifier(env);
    for (const bad of ['', 'not-a-jwt', 'a.b.c']) {
      await expect(verify!(bad)).rejects.toThrow();
    }
  });

  it('uses JWKS when no shared secret is set', async () => {
    // Without a secret the verifier is built against the project's published
    // keys; it must still be constructed, not silently null.
    const verify = await createSupabaseVerifier({ SUPABASE_URL: PROJECT_URL } as NodeJS.ProcessEnv);
    expect(verify).toBeTypeOf('function');
  });
});
