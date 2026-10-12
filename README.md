# Luxury Villas

Prerendered website built with Astro, with a server-side Olivia chat endpoint. Development takes place on the `dev` branch.

## Local development

Use Node.js 24 and install dependencies with `npm ci`.

- `npm run dev`: start the development server.
- `npm run build`: generate the pages in `dist/client/` and the Vercel chat function.
- `npm run preview`: preview the generated site.

## Structure

- `src/pages/index.astro`: English home page.
- `src/pages/es/index.astro`: Spanish home page.
- `src/pages/privacy-policy/index.astro`: privacy policy.
- `public/assets/`: images and video, served at `/assets/`.

The migration preserves the existing page markup, inline global styles and
browser scripts. Images retain their original files and quality.

## Deployment

The linked Vercel project uses the Astro configuration in `vercel.json` and
uses the Vercel adapter to serve prerendered pages and the chat API. Build with `vercel build --prod`, then deploy using
`vercel deploy --prebuilt --prod`.

## Olivia AI

See [the integration guide](docs/olivia.md) for the VPS2 gateway, environment
configuration and verification.

## SEO content

Use [the keyword reference](docs/seo-keywords.md) for all SEO copy changes.
Run `npm run test:seo` after building to validate metadata and discovery files.
