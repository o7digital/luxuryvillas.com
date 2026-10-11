# Luxury Villas

Static website built with Astro. Development takes place on the `dev` branch.

## Local development

Use Node.js 24 and install dependencies with `npm ci`.

- `npm run dev`: start the development server.
- `npm run build`: generate the static site in `dist/`.
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
serves `dist/`. Build with `vercel build --prod`, then deploy using
`vercel deploy --prebuilt --prod`.
