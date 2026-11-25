import { normalizeEnquiry } from '../../infrastructure/olivia/enquiry.mjs';
import { randomUUID } from 'node:crypto';
import { conversationToken, inboxRequest, publicSnapshot } from './olivia-inbox.mjs';

const json = (status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function allowedOrigin(request: Request, allowMissing = false) {
  const allowed = new Set([
    'https://www.luxuryvillasbylacasaquecanta.com', 'https://luxuryvillasbylacasaquecanta.com',
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
    ...(import.meta.env.DEV ? ['http://localhost:4321', 'http://127.0.0.1:4321', 'http://localhost:4330', 'http://127.0.0.1:4330'] : []),
  ].filter(Boolean));
  const origin = request.headers.get('origin');
  return (!origin && allowMissing) || (origin && allowed.has(origin));
}

const gatewayKey = () => process.env.OLIVIA_GATEWAY_KEY || import.meta.env.OLIVIA_GATEWAY_KEY;
const inboxKey = () => process.env.LUXURYVILLAS_INBOX_KEY || import.meta.env.LUXURYVILLAS_INBOX_KEY;

export async function oliviaSnapshotRequest(request: Request) {
  if (!allowedOrigin(request, true)) return json(403, { error: 'Origin not allowed' });
  let token;
  try { token = conversationToken(new URL(request.url).searchParams.get('conversation') || '', gatewayKey()); }
  catch { return json(403, { error: 'Invalid conversation' }); }
  try { return json(200, publicSnapshot(await inboxRequest(token, inboxKey()))); }
  catch { return json(503, { error: 'Conversation unavailable' }); }
}

export async function oliviaRequest(request: Request, clientAddress: string, contact = false) {
  if (!allowedOrigin(request)) return json(403, { error: 'Origin not allowed' });
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return json(415, { error: 'JSON required' });
  let token: string | undefined;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16000) return json(413, { error: 'Request too large' });
    let body;
    try { body = JSON.parse(raw); } catch { return json(400, { error: 'Invalid JSON' }); }
    if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > (contact ? 5000 : 2000) || !['es', 'en'].includes(body.language) || body.consent !== true || (body.conversation != null && (typeof body.conversation !== 'string' || !/^[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/.test(body.conversation)))) return json(400, { error: 'Invalid message or consent' });
    if (body.requestId != null && (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(body.requestId))) return json(400, { error: 'Invalid request' });
    if (body.page != null && !['/', '/es/', '/privacy-policy/'].includes(body.page)) return json(400, { error: 'Invalid page' });
    const details = contact ? normalizeEnquiry(body, { allowLegacy: true }) : null;
    if (contact && !details) return json(400, { error: 'Invalid contact details or stay dates' });
    const key = gatewayKey();
    if (!key || !inboxKey()) return json(503, { error: 'Olivia unavailable' });
    try { token = conversationToken(body.conversation, key); }
    catch { return json(403, { error: 'Invalid conversation' }); }
    const requestId = body.requestId || randomUUID();
    const context = { language: body.language, page: body.page || (body.language === 'es' ? '/es/' : '/') };
    const initial = await inboxRequest(token, inboxKey(), {
      ...context,
      messages: [{ role: 'visitor', content: body.message.trim().slice(0, 2000), externalId: `${requestId}:${contact ? 'contact' : 'visitor'}` }],
      ...(contact ? { contact: { ...details, need: body.message.trim(), consent: true } } : {}),
    });
    if (!contact && initial.conversation?.status === 'manual') return json(200, { answer: '', conversation: token, status: 'manual' });
    const cached = !contact && initial.messages.find(message => message.role === 'ai' && message.metadata?.luxuryvillasExternalId === `${requestId}:assistant`);
    if (cached) return json(200, { answer: cached.content, conversation: token, version: '3.6.0', status: initial.conversation?.status || 'ai' });
    const response = await fetch('https://olivia.o7digitalgroup.com/luxuryvillas/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'X-Visitor-IP': clientAddress },
      body: JSON.stringify({ message: body.message.trim(), language: body.language, conversation: token,
        ...(contact ? { ...details, action: 'contact', consent: true } : {}),
      }), signal: AbortSignal.timeout(57000),
    });
    if (!response.ok) return json([400, 403, 429].includes(response.status) ? response.status : 503, { error: contact ? 'Enquiry not sent' : 'Olivia unavailable', conversation: token });
    const data = await response.json();
    if (typeof data.version !== 'string' || !/^3\.6(?:\.|$)/.test(data.version)) return json(503, { error: 'Olivia 3.6 unavailable' });
    if (contact) {
      if (data.ok !== true || data.submitted !== true) return json(503, { error: 'Enquiry not sent' });
      return json(200, { ok: true, submitted: true, version: data.version, conversation: token });
    }
    if (typeof data.answer !== 'string' || !data.answer.trim() || data.conversation !== token) return json(503, { error: 'Olivia unavailable' });
    const saved = await inboxRequest(token, inboxKey(), { ...context, messages: [{ role: 'ai', content: data.answer, externalId: `${requestId}:assistant` }] });
    if (saved.conversation?.status === 'manual') return json(200, { answer: '', conversation: token, status: 'manual' });
    return json(200, { answer: data.answer, conversation: token, version: data.version, status: saved.conversation?.status || 'ai' });
  } catch { return json(503, { error: contact ? 'Enquiry not sent' : 'Olivia unavailable', ...(token ? { conversation: token } : {}) }); }
}
