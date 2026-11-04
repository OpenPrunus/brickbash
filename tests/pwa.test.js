// PWA : le jeu peut s'installer et se lancer hors ligne.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const read = (f) => fs.readFileSync(path.join(WEB, f), 'utf8');
const manifest = JSON.parse(read('manifest.webmanifest'));

test('manifeste : nom, démarrage, affichage, couleurs et icônes qui existent', () => {
  assert.ok(manifest.name && manifest.short_name);
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.display, 'standalone');
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(WEB, icon.src)), icon.src);
  assert.ok(fs.existsSync(path.join(WEB, 'icons/apple-touch-icon.png')));
});

test('la page relie le manifeste, l\'icône iOS et enregistre le service worker', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /<script src="pwa\.js" defer><\/script>/);
  assert.match(read('pwa.js'), /serviceWorker\.register\('sw\.js'\)/);
});

test('service worker : réseau d\'abord, cache en secours', () => {
  const sw = read('sw.js');
  assert.match(sw, /addEventListener\('fetch'/);
  assert.match(sw, /caches\.match/);
  new Function(sw.replace(/self\.addEventListener/g, '(() => {})'));        // syntaxe valide
});

test('aucun script ni style en ligne (la politique de sécurité du contenu les interdit)', () => {
  const html = read('index.html');
  assert.doesNotMatch(html.replace(/<script (?:type="module" )?src="[^"]+"(?: defer)?><\/script>/g, ''), /<script/);
  assert.doesNotMatch(html, /<style/);
  assert.doesNotMatch(html, /\sstyle="/);
});
