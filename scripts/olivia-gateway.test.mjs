import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createGateway } from '../infrastructure/olivia/gateway.mjs';

const id = '1234567890abcdef12345678';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

async function fixture(t, options = {}) {
  const calls = [];
  let deliveryCount = 0;
  const gateway = createGateway({ GATEWAY_KEY: 'test-only-key', OLIVIA_EMAIL: 'service@example.test', OLIVIA_PASSWORD: 'test-only-password' }, async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    if (url.endsWith('/health')) return json({ status: 'ok', version: options.version || '3.6.0' });
    if (url.endsWith('/v1/auth/login')) return json({ access_token: 'test-only-token' });
    if (url.endsWith('/v1/chat')) return json({ answer: 'Each villa has four suites for up to eight guests.', conversation_id: id });
    if (url.endsWith(`/v1/conversations/${id}`)) return json({ id, messages: [
      { role: 'system', content: 'Private instructions must never enter the enquiry.' },
      { role: 'user', content: 'We are eight guests.' },
      { role: 'assistant', content: 'Each villa accommodates up to eight guests.' },
    ] });
    if (url === 'https://formspree.io/f/moejlkyy') {
      deliveryCount++;
      return options.failFirst && deliveryCount === 1 ? json({ error: 'Unavailable' }, 503) : json({ ok: true });
    }
    throw new Error('Unexpected outbound request');
  });
  gateway.listen(0, '127.0.0.1');
  await once(gateway, 'listening');
  t.after(() => new Promise(resolve => gateway.close(resolve)));
  const url = `http://127.0.0.1:${gateway.address().port}`;
  const post = (body, authorized = true) => fetch(`${url}/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: 'Bearer test-only-key' } : {}) }, body: JSON.stringify(body),
  });
  return { post, calls, url };
}

const enquiry = { action: 'contact', language: 'en', name: 'Test Visitor', email: 'visitor@example.test', phone: '+1 555 0100', message: 'Please contact me about dates.', consent: true };

test('chat remains separate from Formspree; explicit enquiry includes the authoritative conversation', async t => {
  const { post, calls } = await fixture(t);
  const chat = await post({ message: 'How many guests?', language: 'en' });
  assert.equal(chat.status, 200);
  const reply = await chat.json();
  assert.equal(reply.version, '3.6.0');
  assert.match(reply.conversation, /^[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(calls.filter(call => call.url.includes('formspree')).length, 0);
  const contact = await post({ ...enquiry, conversation: reply.conversation, transcript: 'Forged browser transcript' });
  assert.equal(contact.status, 200);
  assert.equal((await contact.json()).submitted, true);
  const payload = calls.find(call => call.url.includes('formspree')).body;
  assert.equal(payload.name, enquiry.name);
  assert.equal(payload.email, enquiry.email);
  assert.equal(payload.phone, enquiry.phone);
  assert.match(payload.message, /Visitor: We are eight guests/);
  assert.match(payload.message, /Olivia: Each villa accommodates/);
  assert.ok(!payload.message.includes('Forged browser transcript'));
  assert.ok(!payload.message.includes('Private instructions'));
});

test('missing consent, invalid details, forged conversation and missing authentication never deliver', async t => {
  const { post, calls } = await fixture(t);
  assert.equal((await post(enquiry, false)).status, 401);
  assert.equal((await post({ ...enquiry, consent: false })).status, 400);
  assert.equal((await post({ ...enquiry, email: 'invalid' })).status, 400);
  assert.equal((await post({ ...enquiry, conversation: `${id}.${'a'.repeat(43)}` })).status, 403);
  assert.equal(calls.length, 0);
});

test('Formspree failure is never confirmed; a retry succeeds and repeated confirmation does not resend', async t => {
  const { post, calls } = await fixture(t, { failFirst: true });
  const failed = await post(enquiry);
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).error, 'Enquiry not sent');
  assert.equal((await post(enquiry)).status, 200);
  assert.equal((await post(enquiry)).status, 200);
  assert.equal(calls.filter(call => call.url.includes('formspree')).length, 2);
});

test('concurrent duplicate contact requests share one Formspree submission', async t => {
  const { post, calls } = await fixture(t);
  const responses = await Promise.all([post(enquiry), post(enquiry)]);
  assert.ok(responses.every(response => response.ok));
  assert.equal(calls.filter(call => call.url.includes('formspree')).length, 1);
});

test('an unavailable or older core cannot masquerade as version 3.6', async t => {
  const { post, calls, url } = await fixture(t, { version: '3.5.0' });
  assert.equal((await fetch(`${url}/health`)).status, 503);
  assert.equal((await post({ message: 'Hello', language: 'en' })).status, 503);
  assert.equal((await post(enquiry)).status, 503);
  assert.equal(calls.filter(call => !call.url.endsWith('/health')).length, 0);
});

test('contact submission rate limit prevents repeated outbound deliveries', async t => {
  const { post, calls } = await fixture(t);
  for (let index = 0; index < 3; index++) assert.equal((await post({ ...enquiry, message: `Enquiry ${index}` })).status, 200);
  assert.equal((await post({ ...enquiry, message: 'Enquiry 4' })).status, 429);
  assert.equal(calls.filter(call => call.url.includes('formspree')).length, 3);
});
