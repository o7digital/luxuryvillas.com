import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isEnquiryIntent, normalizeEnquiry, todayInZihuatanejo } from '../infrastructure/olivia/enquiry.mjs';

test('information and booking enquiries open the form in visitor languages', () => {
  for (const message of ['I would like more information', 'Can you send me details?', 'What are your rates?', 'Is El Ensueño available?', 'I would like to book a villa', 'I would like to book', 'How much is a stay?', 'Tell me more', 'Please contact me', 'Quisiera información sobre las villas', '¿Cuál es la disponibilidad?', 'Quiero reservar', 'Je voudrais des infos', 'Je souhaite un devis', 'Quelles sont vos disponibilités ?', 'Appelez-moi sur WhatsApp']) {
    assert.equal(isEnquiryIntent(message), true, message);
  }
  for (const message of ['Hello', 'How many guests can stay in each villa?', 'What is the difference between El Ensueño and El Murmullo?', 'Does El Ensueño have an infinity pool?', '¿Cuántas suites tiene cada villa?', 'Bonjour, où se trouvent les villas ?']) {
    assert.equal(isEnquiryIntent(message), false, message);
  }
});

const details = { contactFormVersion: 2, firstName: ' Jane ', lastName: ' Visitor ', email: 'JANE@example.test', arrivalDate: '2027-03-12', departureDate: '', phone: '+1 555 0100', whatsapp: '' };
const normalize = body => normalizeEnquiry(body, { today: '2026-11-22' });

test('arrival, names, email and either mobile or WhatsApp produce complete normalized details', () => {
  const result = normalize(details);
  assert.equal(result.name, 'Jane Visitor');
  assert.equal(result.email, 'jane@example.test');
  assert.equal(result.arrivalDate, details.arrivalDate);
  assert.ok(normalize({ ...details, phone: '', whatsapp: '+52 755 123 4567' }));
  assert.ok(normalize({ ...details, whatsapp: '+52 755 123 4567' }));
  assert.equal(normalize({ ...details, phone: '', whatsapp: '' }), null);
  assert.equal(normalize({ ...details, lastName: '' }), null);
  assert.equal(normalize({ ...details, email: 'invalid' }), null);
  assert.equal(normalize({ ...details, phone: 'not a number' }), null);
});

test('stay dates reject nonexistent days, past arrivals and departure before or on arrival', () => {
  assert.equal(normalize({ ...details, arrivalDate: '2027-02-30' }), null);
  assert.equal(normalize({ ...details, arrivalDate: '2026-11-21' }), null);
  assert.equal(normalize({ ...details, departureDate: '2027-03-11' }), null);
  assert.equal(normalize({ ...details, departureDate: '2027-03-12' }), null);
  assert.ok(normalize({ ...details, departureDate: '2027-03-13' }));
  assert.ok(normalize({ ...details, arrivalDate: '2026-11-22' }));
  assert.equal(todayInZihuatanejo(new Date('2026-11-23T02:00:00Z')), '2026-11-22');
});
