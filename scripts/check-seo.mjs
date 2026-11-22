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
  assert.ok(html.includes('name="robots" content="index, follow, max-image-preview:large"'));
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
    const heading = html.match(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/)[1];
    assert.match(heading, /Luxury Villas (?:in|en) Zihuatanejo/);
    const data = JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1]);
    const graph = data['@graph'];
    assert.ok(Array.isArray(graph));
    const ids = new Set(graph.map(node => node['@id']));
    assert.equal(ids.size, graph.length, 'Structured entities need unique IDs');
    const organization = graph.find(node => node['@type'] === 'Organization');
    const website = graph.find(node => node['@type'] === 'WebSite');
    const page = graph.find(node => node['@type'] === 'CollectionPage');
    const collection = graph.find(node => node['@type'] === 'ItemList');
    assert.equal(organization['@id'], site + '/#luxury-villas');
    assert.equal(website.url, site + '/');
    assert.equal(page.url, site + route);
    assert.equal(page.inLanguage, route === '/es/' ? 'es' : 'en');
    assert.equal(page.name, html.match(/<title>(.*?)<\/title>/)[1]);
    assert.equal(page.description, html.match(/name="description" content="([^"]+)"/)[1]);
    assert.equal(collection.numberOfItems, 2);
    assert.equal(collection.itemListElement.length, 2);
    assert.equal(graph.filter(node => node['@type'] === 'LodgingBusiness').length, 2);
    for (const item of collection.itemListElement) {
      assert.ok(html.includes(`id="${new URL(item.url).hash.slice(1)}"`), 'Villa links must target real page sections');
    }
    const checkReferences = value => {
      if (!value || typeof value !== 'object') return;
      if (value['@id']) assert.ok(ids.has(value['@id']), `Unresolved structured reference: ${value['@id']}`);
      if (value['@type'] === 'ImageObject') {
        const path = new URL(value.contentUrl ?? value.url).pathname;
        assert.ok(existsSync(output + path), `Missing structured image: ${path}`);
      }
      for (const child of Object.values(value)) checkReferences(child);
    };
    checkReferences(graph);
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
