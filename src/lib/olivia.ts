import { normalizeEnquiry } from '../../infrastructure/olivia/enquiry.mjs';

const json = (status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export async function oliviaRequest(request: Request, clientAddress: string, contact = false) {
  const allowed = new Set([
    'https://www.luxuryvillasbylacasaquecanta.com', 'https://luxuryvillasbylacasaquecanta.com',
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
    ...(import.meta.env.DEV ? ['http://localhost:4321', 'http://127.0.0.1:4321', 'http://localhost:4330', 'http://127.0.0.1:4330'] : []),
  ].filter(Boolean));
  const origin = request.headers.get('origin');
  if (!origin || !allowed.has(origin)) return json(403, { error: 'Origin not allowed' });
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return json(415, { error: 'JSON required' });
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16000) return json(413, { error: 'Request too large' });
    let body;
    try { body = JSON.parse(raw); } catch { return json(400, { error: 'Invalid JSON' }); }
    if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > (contact ? 5000 : 2000) || !['es', 'en'].includes(body.language) || body.consent !== true || (body.conversation != null && (typeof body.conversation !== 'string' || !/^[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/.test(body.conversation)))) return json(400, { error: 'Invalid message or consent' });
    const details = contact ? normalizeEnquiry(body, { allowLegacy: true }) : null;
    if (contact && !details) return json(400, { error: 'Invalid contact details or stay dates' });
    const key = process.env.OLIVIA_GATEWAY_KEY || import.meta.env.OLIVIA_GATEWAY_KEY;
    if (!key) return json(503, { error: 'Olivia unavailable' });
    const response = await fetch('https://olivia.o7digitalgroup.com/luxuryvillas/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'X-Visitor-IP': clientAddress },
      body: JSON.stringify({ message: body.message.trim(), language: body.language, conversation: body.conversation,
        ...(contact ? { ...details, action: 'contact', consent: true } : {}),
      }), signal: AbortSignal.timeout(57000),
    });
    if (!response.ok) return json([400, 403, 429].includes(response.status) ? response.status : 503, { error: contact ? 'Enquiry not sent' : 'Olivia unavailable' });
    const data = await response.json();
    if (typeof data.version !== 'string' || !/^3\.6(?:\.|$)/.test(data.version)) return json(503, { error: 'Olivia 3.6 unavailable' });
    if (contact) {
      if (data.ok !== true || data.submitted !== true) return json(503, { error: 'Enquiry not sent' });
      return json(200, { ok: true, submitted: true, version: data.version });
    }
    if (typeof data.answer !== 'string' || !data.answer.trim() || typeof data.conversation !== 'string') return json(503, { error: 'Olivia unavailable' });
    return json(200, { answer: data.answer, conversation: data.conversation, version: data.version });
  } catch { return json(503, { error: contact ? 'Enquiry not sent' : 'Olivia unavailable' }); }
}
