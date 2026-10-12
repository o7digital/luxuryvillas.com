import type { APIRoute } from 'astro';
export const prerender = false;
const json = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const origin = request.headers.get('origin');
  const allowed = new Set([
    'https://www.luxuryvillasbylacasaquecanta.com',
    'https://luxuryvillasbylacasaquecanta.com',
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
    ...(import.meta.env.DEV ? ['http://localhost:4321', 'http://127.0.0.1:4321', 'http://localhost:4330', 'http://127.0.0.1:4330'] : []),
  ].filter(Boolean));
  if (!origin || !allowed.has(origin)) return json(403, { error: 'Origin not allowed' });
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return json(415, { error: 'JSON required' });
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16000) return json(413, { error: 'Request too large' });
    let body;
    try { body = JSON.parse(raw); } catch { return json(400, { error: 'Invalid JSON' }); }
    if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000 || !['es', 'en'].includes(body.language) || body.consent !== true || (body.conversation != null && (typeof body.conversation !== 'string' || body.conversation.length > 180))) return json(400, { error: 'Invalid message' });
    const gatewayKey = process.env.OLIVIA_GATEWAY_KEY || import.meta.env.OLIVIA_GATEWAY_KEY;
    if (!gatewayKey) return json(503, { error: 'Olivia unavailable' });
    const response = await fetch('https://olivia.o7digitalgroup.com/luxuryvillas/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gatewayKey}`, 'X-Visitor-IP': clientAddress },
      body: JSON.stringify({ message: body.message.trim(), language: body.language, conversation: body.conversation }), signal: AbortSignal.timeout(57000),
    });
    if (!response.ok) return json(response.status === 429 ? 429 : response.status === 403 ? 403 : 503, { error: 'Olivia unavailable' });
    const data = await response.json();
    if (typeof data.answer !== 'string' || typeof data.conversation !== 'string') return json(503, { error: 'Olivia unavailable' });
    return json(200, { answer: data.answer, conversation: data.conversation });
  } catch { return json(503, { error: 'Olivia unavailable' }); }
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: 'POST' } });
