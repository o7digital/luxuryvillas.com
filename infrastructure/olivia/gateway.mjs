import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { normalizeEnquiry } from './enquiry.mjs';
const tenant = 'luxuryvillas';
const equal = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function createGateway(env = process.env, fetcher = fetch) {
  const key = env.GATEWAY_KEY;
  if (!key || !env.OLIVIA_PASSWORD || !env.OLIVIA_EMAIL) throw new Error('Gateway credentials required');
  const core = env.OLIVIA_API_URL || 'http://core:8093';
  const sign = value => createHmac('sha256', key).update(value).digest('base64url');
  const limits = new Map(), deliveries = new Map();
  let token, expires = 0, health, checked = 0;
  const timer = setInterval(() => {
    for (const [id, value] of limits) if (value.until < Date.now()) limits.delete(id);
    for (const [id, value] of deliveries) if (value.until < Date.now()) deliveries.delete(id);
  }, 60000).unref();
  async function version() {
    if (checked > Date.now()) return health.version;
    const response = await fetcher(`${core}/health`, { signal: AbortSignal.timeout(5000) });
    health = await response.json();
    if (!response.ok || health.status !== 'ok' || !/^3\.6(?:\.|$)/.test(health.version)) throw new Error('Olivia 3.6 core unavailable');
    checked = Date.now() + 30000; return health.version;
  }
  async function upstream(path, body, retry = true, allowMissing = false) {
    if (expires < Date.now()) {
      const response = await fetcher(`${core}/v1/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenant },
        body: JSON.stringify({ email: env.OLIVIA_EMAIL, password: env.OLIVIA_PASSWORD }), signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      if (!response.ok || typeof data.access_token !== 'string') throw new Error('Core authentication unavailable');
      token = data.access_token; expires = Date.now() + 3300000;
    }
    const response = await fetcher(`${core}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenant, Authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(50000),
    });
    if (response.status === 401 && retry) { expires = 0; return upstream(path, body, false, allowMissing); }
    if (response.status === 404 && allowMissing) return null;
    if (!response.ok) throw new Error(`Core request failed (${response.status})`);
    return response.json();
  }
  function conversation(value) {
    if (value == null) return undefined;
    if (typeof value !== 'string' || !/^[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/.test(value)) throw new Error('Invalid conversation');
    const [id, signature] = value.split('.');
    if (!equal(signature, sign(id))) throw new Error('Invalid conversation');
    return id;
  }
  const server = http.createServer(async (req, res) => {
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    if (req.url === '/health' && req.method === 'GET') {
      try { return json(200, { status: 'ok', version: await version(), tenant }); }
      catch { return json(503, { status: 'unavailable', tenant }); }
    }
    if (req.url !== '/chat' || req.method !== 'POST') return json(404, { error: 'Not found' });
    if (!equal(req.headers.authorization, `Bearer ${key}`)) return json(401, { error: 'Unauthorized' });
    let body;
    try {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16000) return json(413, { error: 'Request too large' }); }
      body = JSON.parse(raw);
    } catch { return json(400, { error: 'Invalid JSON' }); }
    if (!body || !['es', 'en'].includes(body.language)) return json(400, { error: 'Invalid language' });
    let cid;
    try { cid = conversation(body.conversation); } catch { return json(403, { error: 'Invalid conversation' }); }
    const contact = body.action === 'contact';
    if (body.action && !contact) return json(400, { error: 'Invalid action' });
    const rateId = `${contact ? 'contact' : 'chat'}:${req.headers['x-visitor-ip'] || 'unknown'}`;
    const rate = limits.get(rateId) || { count: 0, until: Date.now() + 60000 };
    if (rate.until < Date.now()) { rate.count = 0; rate.until = Date.now() + 60000; }
    rate.count++; limits.set(rateId, rate);
    if (limits.size > 5000) limits.delete(limits.keys().next().value);
    if (rate.count > (contact ? 3 : 12)) return json(429, { error: 'Too many requests' });
    if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > (contact ? 5000 : 2000)) return json(400, { error: 'Invalid message' });
    const details = contact ? normalizeEnquiry(body, { allowLegacy: true }) : null;
    if (contact && (body.consent !== true || !details)) return json(400, { error: 'Invalid contact details, dates or consent' });
    try {
      const coreVersion = await version();
      if (!contact) {
        const result = await upstream('/v1/chat', { conversation_id: cid, routing: 'FAST', message: body.message.trim() });
        if (typeof result.answer !== 'string' || !result.answer.trim() || !/^[a-f0-9]{24}$/.test(result.conversation_id)) throw new Error('Invalid core response');
        return json(200, { answer: result.answer, conversation: `${result.conversation_id}.${sign(result.conversation_id)}`, version: coreVersion });
      }
      const operationId = sign(JSON.stringify([cid, details, body.message.trim(), body.language]));
      if (!deliveries.has(operationId)) {
        const operation = (async () => {
          let transcript = '';
          if (cid) {
            const record = await upstream(`/v1/conversations/${cid}`, undefined, true, true);
            if (record && (record.id !== cid || !Array.isArray(record.messages))) throw new Error('Conversation unavailable');
            transcript = (record?.messages || []).filter(message => ['user', 'assistant'].includes(message.role)).slice(-60)
              .map(message => `${message.role === 'user' ? 'Visitor' : 'Olivia'}: ${message.content}`).join('\n\n').slice(-30000);
          }
          const stay = details.contactFormVersion === 2 ? `\n\n--- Stay and contact details ---\nFirst name: ${details.firstName}\nLast name: ${details.lastName}\nArrival: ${details.arrivalDate}\nDeparture: ${details.departureDate || 'Not specified'}\nMobile: ${details.phone || 'Not specified'}\nWhatsApp: ${details.whatsapp || 'Not specified'}` : '';
          const page = `https://www.luxuryvillasbylacasaquecanta.com/${body.language === 'es' ? 'es/' : ''}`;
          const response = await fetcher('https://formspree.io/f/moejlkyy', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: 'https://www.luxuryvillasbylacasaquecanta.com', Referer: page }, signal: AbortSignal.timeout(20000),
            body: JSON.stringify({ name: details.name, email: details.email, phone: details.phone,
              first_name: details.firstName || '', last_name: details.lastName || '', arrival_date: details.arrivalDate || '', departure_date: details.departureDate || '', whatsapp: details.whatsapp || '',
              message: body.message.trim() + stay + (transcript ? `\n\n--- Olivia conversation ---\n\n${transcript}` : ''),
              _subject: 'Luxury Villas — Olivia AI enquiry', source: 'Olivia AI 3.6 — Luxury Villas', language: body.language,
              page,
              conversation_id: cid || '', consent: 'Visitor explicitly approved sending this enquiry and conversation to reservations.',
            }),
          });
          const result = await response.json();
          if (!response.ok || !result || result.ok === false || result.error || result.errors?.length) throw new Error('Formspree did not accept the enquiry');
          return { ok: true, submitted: true, version: coreVersion };
        })();
        deliveries.set(operationId, { until: Date.now() + 3600000, result: operation });
        if (deliveries.size > 1000) deliveries.delete(deliveries.keys().next().value);
      }
      try { return json(200, await deliveries.get(operationId).result); }
      catch (error) { deliveries.delete(operationId); throw error; }
    } catch (error) {
      console.error('Luxury Villas Olivia request failed:', error.message);
      return json(503, { error: contact ? 'Enquiry not sent' : 'Olivia unavailable' });
    }
  });
  server.on('close', () => clearInterval(timer)); return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) createGateway().listen(3098, '0.0.0.0');
