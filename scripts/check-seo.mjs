import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const site = 'https://luxuryvillasbylacasaquecanta.com';
for (const route of ['/', '/es/', '/privacy-policy/']) {
  const html = readFileSync(`dist${route}index.html`, 'utf8');
  assert.equal([...html.matchAll(/rel="canonical"/g)].length, 1);
  assert.ok(html.includes(`rel="canonical" href="${site}${route}"`));
  assert.ok(html.includes(`property="og:url" content="${site}${route}"`));
  assert.ok(html.includes('property="og:image"'));
  assert.ok(html.includes('name="twitter:image"'));
  assert.ok(!html.includes('github.com/o7digital'));
  if (route !== '/privacy-policy/') {
    for (const [language, path] of [['en', '/'], ['es', '/es/'], ['x-default', '/']]) {
      assert.ok(html.includes(`hreflang="${language}" href="${site}${path}"`));
    }
    const data = JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1]);
    assert.equal(data.url, site + route);
    assert.equal(data['@id'], site + '/#luxury-villas');
  } else {
    assert.ok(!html.includes('hreflang='));
  }
  for (const match of html.matchAll(/(?:src|content)="(\/assets\/[^"]+)"/g)) {
    assert.ok(existsSync('dist' + match[1]));
  }
}
const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
assert.equal([...sitemap.matchAll(/<loc>/g)].length, 3);
for (const route of ['/', '/es/', '/privacy-policy/']) assert.ok(sitemap.includes(`<loc>${site}${route}</loc>`));
assert.ok(readFileSync('dist/robots.txt', 'utf8').includes(`Sitemap: ${site}/sitemap.xml`));
console.log('SEO checks passed for all pages, sitemap and robots.txt.');
