import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const endpoint = 'https://olivia-ai.o7digital.com/api/internal/luxuryvillas';
export function conversationToken(value, key) {
  if (!key) throw new Error('Missing gateway key');
  const sign = id => createHmac('sha256', key).update(id).digest('base64url');
  if (value == null) {
    const id = randomBytes(12).toString('hex');
    return `${id}.${sign(id)}`;
  }
  if (typeof value !== 'string' || !/^[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/.test(value)) throw new Error('Invalid conversation');
  const [id, signature] = value.split('.');
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(sign(id)))) throw new Error('Invalid conversation');
  return value;
}

export async function inboxRequest(token, key, payload, fetcher = fetch) {
  if (!key || key.length < 32) throw new Error('Missing inbox key');
  const id = token.split('.')[0];
  const response = await fetcher(payload ? endpoint : `${endpoint}?conversationId=${id}`, {
    method: payload ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
    ...(payload ? { body: JSON.stringify({ ...payload, conversationId: id }) } : {}),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Inbox unavailable');
  const data = await response.json();
  if (!Array.isArray(data.messages)) throw new Error('Invalid inbox response');
  return data;
}

export function publicSnapshot(data) {
  return {
    status: data.conversation?.status || 'ai',
    messages: data.messages.filter(message => message.role === 'operator').map(({ id, content, createdAt }) => ({ id, content, createdAt })),
  };
}
