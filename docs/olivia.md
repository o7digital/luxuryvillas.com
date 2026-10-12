# Olivia AI — Luxury Villas

The bilingual floating concierge uses the cream, charcoal and gold design of
`o7digital/suitesmine-bot`. The native web component in
`src/components/OliviaAI.astro` uses Shadow DOM so website CSS cannot change its
layout and widget CSS cannot change the website. The existing page design is
preserved. Consent is required before a message can be sent. Conversations are
kept for the current page only in the browser; the V3 database stores the chat.

Browser → same-origin `POST /api/olivia/` → authenticated gateway
`https://olivia.o7digitalgroup.com/luxuryvillas/chat` → private V3 `/v1/chat`.

VPS2 runs the dedicated gateway from `/opt/o7/apps/luxuryvillas-olivia` using
`infrastructure/olivia/compose.yaml`. It fixes the `luxuryvillas` tenant and uses
its own service account, signed conversation IDs, per-IP rate limits and the
approved facts in `knowledge.txt`. Its `.env` is private and never committed.
`OLIVIA_GATEWAY_KEY` is a server-only Vercel environment variable. No engine
credentials or JWTs are exposed to visitors.

The API accepts only the exact production origins and Vercel's current preview
and branch origins. Local development permits localhost origins. `astro dev`
loads the ignored `.env.local`. All content pages remain prerendered; only the
chat API uses a Vercel function through `@astrojs/vercel`.

Olivia explains El Ensueño, El Murmullo and the published services. Rates,
availability and policies must be confirmed by reservations. She cannot book,
send email or WhatsApp messages, or promise live availability. Direct contact
links remain available if the engine is unavailable.

Update the approved facts locally, copy the three infrastructure files to the
VPS directory and recreate only `luxuryvillas-olivia-gateway`. The proxy uses an
exact route for this gateway; V3 remains private and other sites are unchanged.

Validation: `npm run build`, `npm run test:seo`, browser checks in both languages
and at mobile/desktop sizes, and a real preview → gateway → V3 exchange.
Deploy preview with `vercel build` then `vercel deploy --prebuilt`.
Production needs the same private environment variable before deployment.
Rollback by removing `<OliviaAI>` from the three pages and redeploying; the
new gateway can then be stopped independently.
