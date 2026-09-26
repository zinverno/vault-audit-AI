// Synthetic data only. npm run build, then node scripts/semantic-neighborhood-prepare.mjs /tmp/semantic-neighborhood-smoke
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const root = process.argv[2];
if (!root?.startsWith('/tmp/') || root.includes('..')) throw Error('Supply a disposable /tmp directory');
await build({ entryPoints: ['scripts/semantic-neighborhood-fixture.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: '/tmp/semantic-neighborhood-fixture.cjs' });
const require = createRequire(import.meta.url);
const { semanticNeighborhoodFixture } = require('/tmp/semantic-neighborhood-fixture.cjs');
const plugin = root + '/vault/.obsidian/plugins/ai-knowledge-hub';
await fs.mkdir(plugin, { recursive: true }); await fs.mkdir(root + '/profile', { recursive: true });
await fs.writeFile(plugin + '/data.json', JSON.stringify({ language: 'en', apiKey: '',
  semantic: { enabled: true, embeddingProvider: 'ollama', embeddingModel: 'neighborhood-synthetic', embeddingBaseUrl: 'http://127.0.0.1:11434', openRouterApiKey: '', openAICompatibleApiKey: '' },
  companion: { enabled: false }, health: { profile: 'mixed', profileChosen: true, onboardingCompleted: true } }, null, 2));
await fs.writeFile(root + '/vault/.obsidian/community-plugins.json', '["ai-knowledge-hub"]');
await fs.writeFile(root + '/vault/.obsidian/app.json', '{"checkForUpdates":false}');
await fs.writeFile(root + '/profile/obsidian.json', JSON.stringify({ vaults: { neighborhood: { path: root + '/vault', ts: Date.now(), open: true } } }));
for (const name of ['manifest.json', 'main.js', 'styles.css']) await fs.copyFile(name, plugin + '/' + name);
for (const count of [1, 2, 11, 1000]) {
  const fixture = await semanticNeighborhoodFixture(count), dir = root + '/fixtures/' + count;
  await fs.mkdir(dir, { recursive: true });
  for (const [path, value] of fixture.files) await fs.writeFile(dir + '/' + path.split('/').pop(), typeof value === 'string' ? value : Buffer.from(value));
  await fs.writeFile(dir + '/paths.json', JSON.stringify(fixture.paths));
  if (count !== 11) continue;
  for (const path of fixture.paths) {
    const full = root + '/vault/' + path;
    await fs.mkdir(full.slice(0, full.lastIndexOf('/')), { recursive: true });
    await fs.writeFile(full, '# Synthetic note\n\nNative navigation target; graph evidence comes only from the index.\n');
  }
  await fs.mkdir(plugin + '/semantic-index', { recursive: true });
  for (const [path, value] of fixture.files) await fs.writeFile(plugin + '/semantic-index/' + path.split('/').pop(), typeof value === 'string' ? value : Buffer.from(value));
}
console.log(root);
