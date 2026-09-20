import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '../server/sessions/manager';

describe('SessionManager Unit Tests', () => {
  test('creates a session associated with a specific user', () => {
    const manager = new SessionManager(5000, 10000);
    const session = manager.createSession({ userId: 'user-alice', flow: 'support', llm: 'gemini-3.5-flash' });

    assert.ok(session.id);
    assert.equal(session.userId, 'user-alice');
    assert.equal(session.flow, 'support');
    assert.equal(session.history.length, 0);
    manager.destroy();
  });

  test('enforces cross-tenant isolation and rejects foreign user access', () => {
    const manager = new SessionManager();
    const session = manager.createSession({ userId: 'user-alice', flow: 'support' });

    // Alice can access her session
    const aliceSession = manager.getSession(session.id, 'user-alice');
    assert.ok(aliceSession);
    assert.equal(aliceSession?.id, session.id);

    // Bob cannot access Alice's session
    const bobSession = manager.getSession(session.id, 'user-bob');
    assert.equal(bobSession, null);
    manager.destroy();
  });

  test('adds messages and preserves turn order', () => {
    const manager = new SessionManager();
    const session = manager.createSession({ userId: 'user-alice', flow: 'support' });

    manager.appendTurn(session.id, 'user-alice', 'Hello there', 'Hi Alice!');

    const retrieved = manager.getSession(session.id, 'user-alice');
    assert.equal(retrieved?.history.length, 2);
    assert.equal(retrieved?.history[0].role, 'user');
    assert.equal(retrieved?.history[0].content, 'Hello there');
    assert.equal(retrieved?.history[1].role, 'assistant');
    assert.equal(retrieved?.history[1].content, 'Hi Alice!');
    manager.destroy();
  });

  test('expires sessions after TTL', async () => {
    const manager = new SessionManager(50, 100);
    const session = manager.createSession({ userId: 'user-alice', flow: 'support' });

    assert.ok(manager.getSession(session.id, 'user-alice'));

    // Wait for TTL expiry
    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.equal(manager.getSession(session.id, 'user-alice'), null);
    manager.destroy();
  });
});
