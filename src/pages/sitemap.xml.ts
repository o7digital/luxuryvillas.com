import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const url = (path: string) => new URL(path, site).href;
  const alternates = ['en', 'es', 'x-default'].map(lang =>
    `<xhtml:link rel="alternate" hreflang="${lang}" href="${url(lang === 'es' ? '/es/' : '/')}" />`
  ).join('');
  const entries = ['/', '/es/', '/privacy-policy/'].map(path =>
    `<url><loc>${url(path)}</loc>${path === '/privacy-policy/' ? '' : alternates}</url>`
  ).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
