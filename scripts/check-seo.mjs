import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const output = existsSync('dist/client/index.html') ? 'dist/client' : 'dist';
const site = 'https://www.luxuryvillasbylacasaquecanta.com';
for (const route of ['/', '/es/', '/privacy-policy/']) {
  const html = readFileSync(`${output}${route}index.html`, 'utf8');
  assert.equal([...html.matchAll(/rel="canonical"/g)].length, 1);
  assert.ok(html.includes(`rel="canonical" href="${site}${route}"`));
  assert.ok(html.includes(`property="og:url" content="${site}${route}"`));
  assert.ok(html.includes('property="og:image"'));
  assert.ok(html.includes('name="twitter:image"'));
  assert.ok(!html.includes('github.com/o7digital'));
  assert.ok(!html.includes('<luxury-olivia'), 'Olivia must remain disabled on public pages');
  assert.ok(!html.includes('OLIVIA_GATEWAY_KEY'));
  if (route !== '/privacy-policy/') {
    for (const [language, path] of [['en', '/'], ['es', '/es/'], ['x-default', '/']]) {
      assert.ok(html.includes(`hreflang="${language}" href="${site}${path}"`));
    }
    assert.equal([...html.matchAll(/<h1(?:\s|>)/g)].length, 1);
    assert.ok(!html.includes('id="stay-guide-title"'));
    assert.ok(html.includes('footer-keywords'));
    assert.ok(html.includes('fetchpriority="high"'));
    assert.ok(html.includes('srcset='));
    assert.ok(!html.includes('[data-reveal] { opacity: 0'));
    const data = JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1]);
    assert.equal(data.url, site + route);
    assert.equal(data['@id'], site + '/#luxury-villas');
  } else {
    assert.ok(!html.includes('hreflang='));
  }
  for (const match of html.matchAll(/(?:src|content)="(\/assets\/[^"]+)"/g)) {
    assert.ok(existsSync(output + match[1]));
  }
}
const sitemap = readFileSync(`${output}/sitemap.xml`, 'utf8');
assert.equal([...sitemap.matchAll(/<loc>/g)].length, 3);
for (const route of ['/', '/es/', '/privacy-policy/']) assert.ok(sitemap.includes(`<loc>${site}${route}</loc>`));
assert.ok(readFileSync(`${output}/robots.txt`, 'utf8').includes(`Sitemap: ${site}/sitemap.xml`));
console.log('SEO checks passed for all pages, sitemap and robots.txt.');
