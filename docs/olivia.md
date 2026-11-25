# Olivia AI 3.6 — Luxury Villas

Olivia is enabled on the English, Spanish and privacy pages. The web component
uses Shadow DOM to contain its styles. The existing header, footer, logos,
page content and SEO are preserved. Consent is required before chatting.
The conversation identifier stays in the current page; the private core
stores the conversation in PostgreSQL.

The Channel Manager at `https://olivia-ai.o7digital.com/inbox?client=luxuryvillas`
shows this website under **Luxury Villas by La Casa Que Canta**, separately
from the hotel. The reservations account is restricted to `luxuryvillas`.
The server-only `LUXURYVILLAS_INBOX_KEY`, configured on both Vercel projects,
authenticates the fixed `/api/internal/luxuryvillas` bridge. Visitor requests
are saved before AI generation and replies afterward. Stable request IDs
deduplicate retries. Historical engine messages retain their timestamps;
system instructions are excluded.

Operators can take control and reply from the manager. While in manual mode,
the website does not invoke the AI. The open widget polls its signed
conversation every five seconds via `/api/olivia/messages/`, exposing only
operator text, IDs, timestamps and public status. Contact and stay details
are copied only after the visitor explicitly submits the consented form.
Formspree confirmation remains required before showing enquiry success.

## Chat and enquiries

Browser → `POST /api/olivia/` → authenticated Luxury Villas gateway → private
Olivia 3.6 `/v1/chat`. Chatting alone never sends a Formspree submission.

Information, rates, availability, booking-process and policy questions go to
Olivia. All suggested questions, including “Availability & rates”, receive a
chat answer after consent. An explicit request to book a stay in English,
French or Spanish opens the form with that request prefilled. Information
requests, negated requests and booking changes never trigger it. Visitors can
also click “Request information” to open it. Olivia answers with approved
information first, explains when reservations must confirm details and offers
the form when the visitor wants a quote or to be contacted.
The visitor's latest request prefills the form; earlier chat messages are attached
from the server when the visitor submits. Opening the form sends nothing.

The form collects first and last name, arrival date, optional departure date,
email, and at least one mobile or WhatsApp number. Dates must be valid, arrival
cannot be in the past in Zihuatanejo, and departure must follow arrival.
WhatsApp is a contact field only; there is no WhatsApp button or automated send.
After explicit visitor submission, `/api/olivia/contact/` forwards
these validated fields to the gateway. The gateway verifies the signed
conversation identifier, retrieves the transcript from the core (never from
browser-supplied text), and posts the enquiry plus user/assistant messages to
`https://formspree.io/f/moejlkyy`. System instructions are excluded. The UI
confirms sending only after Formspree accepts it. Failure keeps entered
fields for retry. Identical concurrent or confirmed requests are deduplicated
in gateway memory for one hour; a restart clears this cache. A lost upstream
response can still require a manual check before retrying.

Existing contact forms on `/` and `/es/` already post directly to that same
Formspree endpoint. The footer newsletter has no submission destination and
has deliberately not been changed. Formspree acceptance does not verify email
delivery, recipient settings, spam classification or a staff reply.
The [Formspree documentation](https://help.formspree.io/articles/building-your-form/submit-forms-with-javascript-ajax/)
describes submission acceptance and error handling.

## Runtime

The dedicated stack is on SSH host `o7-vps` (51.178.36.17), under
`/opt/o7/apps/luxuryvillas-olivia`. Compose runs:

- PostgreSQL/pgvector with a dedicated volume and no published port.
- Core and worker image `luxuryvillas-olivia36-core:9286428`, built from private
  `o7digital/olivia-v3` revision `9286428` (actual core version 3.6.0).
- A Node gateway using the existing exact proxy route
  `https://olivia.o7digitalgroup.com/luxuryvillas/chat`.

The gateway verifies the real core health/version and refuses an older engine.
OpenAI `gpt-4.1-mini` handles chat; `text-embedding-3-small` handles retrieval.
The dedicated `luxuryvillas` tenant has its own service identity, database,
tenant-enforced policies, signed conversation IDs and per-IP limits.
The worker has a separate database role. Other assistants and the private
experimental core are unchanged.

Approved instructions come from `site-instructions.txt`, mounted into the
core and ingested as private knowledge. Olivia answers in the visitor's
language. She explains the two villas and published services; reservations
must confirm rates, availability, inclusions and policies. She cannot make
bookings, execute visitor-requested tools or send WhatsApp messages.

## Credentials and deployment

`OLIVIA_GATEWAY_KEY` is a sensitive, server-only Vercel production variable.
The matching gateway key is in the private VPS `.env`. Provider credentials,
service passwords and JWTs never go to the browser or this repository.
Shared enquiry validation rules in `infrastructure/olivia/enquiry.mjs`
contain no credentials and are used by the browser, API and gateway. The
gateway and API retain compatibility for older forms already open in a tab.
Development uses the ignored `.env.local`. APIs allow exact production and
current Vercel deployment/branch origins; development also permits localhost
ports 4321 and 4330.

Provisioning is restricted to the dedicated server directory. Preserve
private backups, then copy `compose.yaml`, `gateway.mjs`,
`enquiry.mjs`, `site-instructions.txt` and `provision.py`. Build the pinned private core image
on the host before starting it. Run these phases in order for a new stack:

```sh
python3 provision.py configure
docker compose up -d postgres
python3 provision.py database
docker compose up -d core
python3 provision.py isolate
docker compose up -d worker
python3 provision.py bootstrap
docker compose up -d gateway
```

The configure phase privately reuses the existing server-side Olivia provider
credential. Generated secrets remain in mode-0600 files on the host. Run
`isolate` again after schema migrations. For gateway edits, copy the file and
run `docker compose up -d --force-recreate gateway`. After updating the
mounted site instructions, `python3 provision.py knowledge` refreshes the
single approved document and its search vectors in a tenant-scoped transaction.
It preserves conversations and makes no change if the approved document is
missing or ambiguous. Gateway health is
available inside the container; the public proxy exposes only the chat route.
Do not run `docker compose down -v`: it deletes the conversation database.

Vercel builds the website and API on Linux through the configured CLI project.
Content pages remain prerendered. `@astrojs/vercel` stays pinned to 11.0.12
because 11.0.13 traces build-time native bindings into the runtime. Production
must have the sensitive gateway variable before deployment.

## Validation and rollback

Run `npm run build`, `npm run test:seo` and `npm run test:olivia`. Gateway tests
exercise separation of chat/contact, server-authoritative transcript,
consent/authentication, rejection of older engines, delivery failures,
retries, duplicate suppression, qualified contact fields, dates, phone/WhatsApp
validation, explicit booking intent, information questions staying in chat
and rate limits. Those Formspree calls are
mocked and send no messages. The packaged function is imported outside the
workspace to detect missing runtime dependencies.

Use Firefox to check real chat in both languages, desktop/mobile, the contact
success/failure UI and the unchanged header/footer before and after deployment.
Any separately authorized actual Formspree test must be clearly marked as a
technical test with no reservation or response requested. Do not load-test it.

Rollback by removing `<OliviaAI>` from the three pages and redeploying.
The dedicated backend can remain private without affecting other sites.
Preserve its database and credentials for diagnosis or re-enabling.
