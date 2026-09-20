import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SlidingWindowRateLimiter } from '../server/security/rateLimiter';

describe('SlidingWindowRateLimiter Unit Tests', () => {
  const createMockRes = () => {
    const headers: Record<string, any> = {};
    let statusCode = 200;
    let jsonBody: any = null;

    const res: any = {
      setHeader(name: string, val: any) {
        headers[name.toLowerCase()] = val;
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonBody = data;
        return this;
      },
    };

    return { res, getStatus: () => statusCode, getJson: () => jsonBody, headers };
  };

  test('permits requests within limit', () => {
    const limiter = new SlidingWindowRateLimiter({
      windowMs: 1000,
      maxRequests: 3,
      keyPrefix: 'test',
    });
    const middleware = limiter.middleware();
    const req: any = { user: { uid: 'user-1' } };

    let calls = 0;
    for (let i = 0; i < 3; i++) {
      const { res } = createMockRes();
      middleware(req, res, () => {
        calls++;
      });
    }

    assert.equal(calls, 3);
    limiter.stop();
  });

  test('blocks requests exceeding limit with 429', () => {
    const limiter = new SlidingWindowRateLimiter({
      windowMs: 1000,
      maxRequests: 2,
      keyPrefix: 'test',
    });
    const middleware = limiter.middleware();
    const req: any = { user: { uid: 'user-burst' } };

    // 2 allowed
    middleware(req, createMockRes().res, () => {});
    middleware(req, createMockRes().res, () => {});

    // 3rd blocked
    let nextCalled = false;
    const { res, getStatus, getJson } = createMockRes();
    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(getStatus(), 429);
    assert.equal(getJson().code, 'RATE_LIMITED');
    limiter.stop();
  });

  test('resets after window expiration', async () => {
    const limiter = new SlidingWindowRateLimiter({
      windowMs: 50,
      maxRequests: 1,
      keyPrefix: 'test',
    });
    const middleware = limiter.middleware();
    const req: any = { user: { uid: 'user-reset' } };

    let firstAllowed = false;
    middleware(req, createMockRes().res, () => {
      firstAllowed = true;
    });
    assert.equal(firstAllowed, true);

    let secondAllowed = false;
    middleware(req, createMockRes().res, () => {
      secondAllowed = true;
    });
    assert.equal(secondAllowed, false);

    // Wait for window expiration
    await new Promise((resolve) => setTimeout(resolve, 80));

    let thirdAllowed = false;
    middleware(req, createMockRes().res, () => {
      thirdAllowed = true;
    });
    assert.equal(thirdAllowed, true);

    limiter.stop();
  });
});
