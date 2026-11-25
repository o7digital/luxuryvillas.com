import assert from 'node:assert/strict';
import { test } from 'node:test';
import { conversationToken, inboxRequest, publicSnapshot } from '../src/lib/olivia-inbox.mjs';
const key = 'test-only-secret-key';

test('conversation polling requires a valid Luxury Villas signature', () => {
  const token = conversationToken(undefined, key);
  assert.match(token, /^[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(conversationToken(token, key), token);
  for (const input of ['', '../other', `${'a'.repeat(24)}.${'a'.repeat(43)}`]) assert.throws(() => conversationToken(input, key));
  assert.throws(() => conversationToken(token, 'another-tenant-key'));
});

test('the widget receives only operator messages and public status', () => {
  assert.deepEqual(publicSnapshot({ conversation: { status: 'manual', email: 'private@example.test' }, messages: [
    { id: '1', role: 'visitor', content: 'Private visitor text' },
    { id: '2', role: 'system', content: 'Private instructions' },
    { id: '3', role: 'operator', content: 'Hello', createdAt: '2026-11-25', metadata: { operatorId: 'private' } },
  ] }), { status: 'manual', messages: [{ id: '3', content: 'Hello', createdAt: '2026-11-25' }] });
});

test('the bridge fixes the Luxury Villas endpoint and uses a server-only key', async () => {
  const token = conversationToken(undefined, key);
  await inboxRequest(token, 'private-inbox-key-'.repeat(3), { messages: [] }, async (url, init) => {
    assert.equal(url, 'https://olivia-ai.o7digital.com/api/internal/luxuryvillas');
    assert.equal(JSON.parse(init.body).conversationId, token.split('.')[0]);
    assert.match(init.headers.Authorization, /^Bearer /);
    return Response.json({ messages: [] });
  });
});
