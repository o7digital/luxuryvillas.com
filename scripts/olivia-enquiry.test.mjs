import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBookingIntent, normalizeEnquiry, todayInZihuatanejo } from '../infrastructure/olivia/enquiry.mjs';

test('explicit booking requests open the form in English, French and Spanish', () => {
  for (const message of [
    'I would like to book a villa', 'I’d like to reserve El Ensueño', 'We want to book for December',
    'I want to make a reservation', 'Can I book?', 'Could you reserve El Ensueño for me?', 'Please book a villa for us', 'Book now',
    'Je veux réserver', 'Je voudrais réserver El Murmullo', 'Nous souhaitons faire une réservation',
    'J’aimerais réserver une villa', 'Je  veux réserver',
    'Puis-je réserver une villa ?', 'Pouvez-vous réserver une villa pour moi ?', 'Je peux réserver pour décembre ?', 'réserver',
    'Quiero reservar', 'Quisiera reservar El Ensueño', 'Me gustaría hacer una reservación',
    '¿Puedo reservar?', 'Queremos hacer una reserva',
  ]) assert.equal(isBookingIntent(message), true, message);
});

test('information, rates, availability and booking guidance stay in chat', () => {
  for (const message of [
    'I would like more information', 'What are your rates?', 'Is El Ensueño available?',
    'What services are available?', 'Tell me more', 'How do I book a villa?', 'What is your booking policy?',
    'I would like information before I book', 'I do not want to book yet', 'I would not like to reserve',
    'I want to cancel my reservation', 'I would like to book a massage',
    'Je voudrais des informations', 'Quels sont les tarifs ?', 'Quelles sont vos disponibilités ?',
    'Comment réserver ?', 'Je voudrais savoir comment réserver', 'Je ne veux pas réserver',
    'Je veux annuler ma réservation', 'Je voudrais réserver un taxi',
    'Quisiera información sobre disponibilidad y tarifas.', '¿Cómo puedo reservar?',
    'Quiero saber cómo reservar', 'No quiero reservar', 'Quiero cancelar mi reserva',
    'Quisiera reservar un masaje',
  ]) assert.equal(isBookingIntent(message), false, message);
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
