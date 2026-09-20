import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { requireAuth } from '../server/auth/middleware';

describe('Auth Middleware Unit Tests', () => {
  test('rejects request with missing Authorization header', async () => {
    const req: any = { headers: {} };
    let responseStatus: number | null = null;
    let responseJson: any = null;

    const res: any = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseJson = data;
        return this;
      },
    };

    let nextCalled = false;
    await requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(responseStatus, 401);
    assert.equal(responseJson.code, 'AUTH_REQUIRED');
  });

  test('rejects request with empty Bearer token', async () => {
    const req: any = { headers: { authorization: 'Bearer   ' } };
    let responseStatus: number | null = null;
    let responseJson: any = null;

    const res: any = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseJson = data;
        return this;
      },
    };

    let nextCalled = false;
    await requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(responseStatus, 401);
    assert.equal(responseJson.code, 'AUTH_TOKEN_EMPTY');
  });

  test('accepts test token in test environment', async () => {
    process.env.NODE_ENV = 'test';
    const req: any = { headers: { authorization: 'Bearer test-token-alice123' } };
    const res: any = {};

    let nextCalled = false;
    await requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user?.uid, 'alice123');
    assert.equal(req.user?.email, 'alice123@pyvex.internal');
  });
});
