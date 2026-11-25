// Shared by the browser, website API and dedicated gateway. No credentials.
export function todayInZihuatanejo(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// Only an explicit request to book opens the stay form. Information and
// booking-process questions must continue to receive a conversational answer.
export function isBookingIntent(message) {
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').toLowerCase().trim();
  if (/\b(?:not|never|don't|dont|do not|pas|jamais|no|nunca)\b.{0,35}\b(?:book|reserve|reserver|reservar|reservation|reserva)\b/.test(text)
    || /\b(?:how|comment|como)\b[^.!?]{0,60}\b(?:book|reserve|reserver|reservar|booking|reservation|reserva)\b/.test(text)
    || /\b(?:cancel|change|modify|annuler|modifier|cancelar|cambiar|modificar)\b.{0,35}\b(?:booking|reservation|reserva|reservacion)\b/.test(text)
    || /\b(?:book|reserve|reserver|reservar)\s+(?:(?:a|an|the|un|une|una|el|la|des|les|los|las)\s+)?(?:taxi|flight|vol|vuelo|restaurant|table|mesa|massage|masaje|yoga|spa|boat|bateau|barco)\b/.test(text)) return false;
  return /\b(?:i|we)(?:'d| would)\s+(?:like|love)\s+to\s+(?:book|reserve|make\s+a\s+(?:booking|reservation))\b/.test(text)
    || /\b(?:i|we)\s+(?:want|wish|need|am ready|are ready)\s+to\s+(?:book|reserve|make\s+a\s+(?:booking|reservation))\b/.test(text)
    || /\b(?:can|could|may|would)\s+(?:i|we|you)\s+(?:please\s+)?(?:book|reserve|make\s+a\s+(?:booking|reservation))\b/.test(text)
    || /\b(?:je|nous|on)\s+(?:veux|voudrais|souhaite|souhaiterais|aimerais|desire|voulons|voudrions|souhaitons|aimerions|veut)\s+(?:bien\s+)?(?:reserver|faire\s+une\s+reservation)\b/.test(text)
    || /\bj'(?:aimerais|aimerai|ai envie de)\s+(?:reserver|faire\s+une\s+reservation)\b/.test(text)
    || /\b(?:puis-je|pouvons-nous|peut-on|pouvez-vous|pourriez-vous|je peux|nous pouvons)\s+reserver\b/.test(text)
    || /\b(?:quiero|quisiera|deseo|desearia|me gustaria|queremos|quisieramos|nos gustaria|necesito|necesitamos|puedo|podemos|podria|podriamos)\s+(?:reservar|hacer\s+una\s+reserva(?:cion)?)\b/.test(text)
    || /^(?:please\s+)?(?:book|reserve)\s+(?:a villa|the villa|my stay|our stay|el ensueno|el murmullo|for|now)\b/.test(text)
    || /^(?:book(?: now)?|reserve|reserver|reservar|reservation|reserva|booking)[.!?\s]*$/.test(text);
}

export function isPhoneNumber(value) {
  return typeof value === 'string' && /^\+?[\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15 && value.length <= 60;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeEnquiry(body, { allowLegacy = false, today = todayInZihuatanejo() } = {}) {
  if (!body || typeof body !== 'object') return null;
  const text = (value, max, optional = false) => value == null && optional ? '' : typeof value === 'string' && value.length <= max && (optional || value.trim()) ? value.trim() : null;
  const email = text(body.email, 254);
  const phone = text(body.phone, 60, true);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone === null) return null;
  // Keep already-open pages working during the gateway/website rollout.
  const legacy = body.contactFormVersion == null && !['firstName', 'lastName', 'arrivalDate', 'departureDate', 'whatsapp'].some(key => key in body);
  if (legacy && allowLegacy) {
    const name = text(body.name, 200);
    return name ? { name, email: email.toLowerCase(), phone } : null;
  }
  if (body.contactFormVersion != null && body.contactFormVersion !== 2) return null;
  const firstName = text(body.firstName, 100), lastName = text(body.lastName, 100);
  const whatsapp = text(body.whatsapp, 60, true), departureDate = text(body.departureDate, 10, true);
  if (!firstName || !lastName || whatsapp === null || departureDate === null || (!phone && !whatsapp) || (phone && !isPhoneNumber(phone)) || (whatsapp && !isPhoneNumber(whatsapp))) return null;
  if (!validDate(body.arrivalDate) || body.arrivalDate < today || (departureDate && (!validDate(departureDate) || departureDate <= body.arrivalDate))) return null;
  return { contactFormVersion: 2, firstName, lastName, name: `${firstName} ${lastName}`, email: email.toLowerCase(), arrivalDate: body.arrivalDate, departureDate, phone, whatsapp };
}
