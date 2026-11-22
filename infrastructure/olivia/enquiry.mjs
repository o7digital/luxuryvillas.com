// Shared by the browser, website API and dedicated gateway. No credentials.
export function todayInZihuatanejo(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function isEnquiryIntent(message) {
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(info(?:s|rmation|rmations|rmacion|rmacoes)?|details|renseignements|devis|quotes?|quotations?|cotiz(?:acion|ar)|rates?|prices?|pricing|costs?|tarif(?:s|a|as)?|precios?|available|availability|disponibles?|disponibil(?:ity|ites?|idad)|bookings?|whatsapp|reserv(?:e|er|ation|ations|ar|a|as))\b/.test(text)
    || /\b(contact|call|llama|llame|appelez)[ -]?(me|us|moi|nos|your|reservations)\b/.test(text)
    || /\b(how much|combien|cuanto|cuesta|tell me more)\b/.test(text)
    || /\b(would like|want|looking|interested|quisiera|quiero|busco|me interesa|souhaite|aimerais|voudrais)\b.{0,50}\b(stay|villa|sejour|estancia|alojar|hospedar)\b/.test(text)
    || /\b(book|booking)\b.{0,20}\b(stay|villa|holiday|reservation)\b/.test(text)
    || /\b(like|want|can i)\b.{0,20}\bbook\b/.test(text);
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
