// Synthetic data only. npm run build, then node scripts/global-semantic-map-prepare.mjs /tmp/global-semantic-map-smoke
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const root = process.argv[2];
if (!root?.startsWith('/tmp/') || root.includes('..')) throw Error('Supply a disposable /tmp directory');
await build({ entryPoints: ['scripts/global-semantic-map-fixture.ts'], bundle: true, plugins: [{ name: 'synthetic-host', setup(build) {
  build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'synthetic' }));
  build.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ contents: 'export const getLanguage = () => "en";' }));
} }], platform: 'node', format: 'cjs', outfile: '/tmp/global-semantic-map-fixture.cjs' });
const require = createRequire(import.meta.url);
const { semanticGlobalMapFixture } = require('/tmp/global-semantic-map-fixture.cjs');
const plugin = root + '/vault/.obsidian/plugins/ai-knowledge-hub';
await fs.mkdir(plugin, { recursive: true }); await fs.mkdir(root + '/profile', { recursive: true });
await fs.writeFile(plugin + '/data.json', JSON.stringify({ language: 'en', apiKey: '',
  semantic: { enabled: true, embeddingProvider: 'ollama', embeddingModel: 'global-map-synthetic', embeddingBaseUrl: 'http://127.0.0.1:11434', openRouterApiKey: '', openAICompatibleApiKey: '' },
  companion: { enabled: false }, health: { profile: 'mixed', profileChosen: true, onboardingCompleted: true } }, null, 2));
await fs.writeFile(root + '/vault/.obsidian/community-plugins.json', '["ai-knowledge-hub"]');
await fs.writeFile(root + '/vault/.obsidian/app.json', '{"checkForUpdates":false}');
await fs.writeFile(root + '/profile/obsidian.json', JSON.stringify({ vaults: { neighborhood: { path: root + '/vault', ts: Date.now(), open: true } } }));
for (const name of ['manifest.json', 'main.js', 'styles.css']) await fs.copyFile(name, plugin + '/' + name);
for (const count of [1, 150, 300, 500, 501]) {
  const fixture = await semanticGlobalMapFixture(count), dir = root + '/fixtures/' + count;
  await fs.mkdir(dir, { recursive: true });
  for (const [path, value] of fixture.files) await fs.writeFile(dir + '/' + path.split('/').pop(), typeof value === 'string' ? value : Buffer.from(value));
  await fs.writeFile(dir + '/paths.json', JSON.stringify(fixture.paths));
  if (count !== 150) continue;
  for (const path of fixture.paths) {
    const full = root + '/vault/' + path;
    await fs.mkdir(full.slice(0, full.lastIndexOf('/')), { recursive: true });
    await fs.writeFile(full, '# Synthetic note\n\nNative navigation target; graph evidence comes only from the index.\n');
  }
  await fs.mkdir(plugin + '/semantic-index', { recursive: true });
  for (const [path, value] of fixture.files) await fs.writeFile(plugin + '/semantic-index/' + path.split('/').pop(), typeof value === 'string' ? value : Buffer.from(value));
}
console.log(root);
