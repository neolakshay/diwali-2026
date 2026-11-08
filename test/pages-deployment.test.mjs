import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import test from 'node:test';

test('runtime assets and module imports work under the GitHub Pages repository prefix', async () => {
  const root = new URL('../', import.meta.url);
  const site = new URL('https://neolakshay.github.io/diwali-2026/');
  const page = await readFile(new URL('index.html', root), 'utf8');
  for (const [, asset] of page.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(?:https?:|#)/.test(asset)) continue;
    assert.ok(!asset.startsWith('/'), asset);
    const url = new URL(asset, site);
    assert.ok(url.pathname.startsWith(site.pathname), asset);
    const local = new URL(asset, root);
    local.search = '';
    assert.ok((await stat(local)).isFile(), asset);
  }
  for (const filename of await readdir(new URL('src/', root))) {
    if (!filename.endsWith('.js')) continue;
    const source = await readFile(new URL(`src/${filename}`, root), 'utf8');
    for (const [, dependency] of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      assert.match(dependency, /^\.\.?\//, `${filename}: ${dependency}`);
      const url = new URL(dependency, new URL(`src/${filename}`, site));
      assert.ok(url.pathname.startsWith(site.pathname), dependency);
      assert.ok((await stat(new URL(dependency, new URL(`src/${filename}`, root)))).isFile(), dependency);
    }
  }
});

test('Pages tests before deployment and publishes an explicit static-file artifact', async () => {
  const workflow = await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.match(workflow, /branches: \[diwali-2026\]/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /needs: build/);
  assert.match(workflow, /path: _site/);
  assert.match(workflow, /cp index\.html styles\.css _site\//);
  assert.match(workflow, /cp src\/\*\.js _site\/src\//);
  assert.match(workflow, /cp audio\/lakshmi-aarti\.mp3 _site\/audio\//);
  assert.ok(workflow.indexOf('run: npm test') < workflow.indexOf('mkdir -p _site'));
  assert.doesNotMatch(workflow, /path: ['"]?\.(?:['"]?\s*$)/m);
});
