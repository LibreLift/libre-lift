const { readdirSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const packageName = '@repdb/exercises';
const packageRoot = dirname(require.resolve(`${packageName}/package.json`));
const directory = 'images/flat';
const files = readdirSync(join(packageRoot, directory))
  .filter((file) => file.endsWith('.webp'))
  .sort();

if (!files.length) throw new Error('RepDB package has no flat WebP illustrations.');

// Metro needs a literal require for each asset to include it in native builds.
const entries = files.map((file) => {
  const path = `${directory}/${file}`;
  return `  [${JSON.stringify(path)}, () => require(${JSON.stringify(`${packageName}/${path}`)})],`;
});

writeFileSync(join(__dirname, '../src/services/repdb-assets.generated.ts'), [
  '// Generated from the installed RepDB package by npm postinstall.',
  'export const repDbAssets = new Map<string, () => number>([',
  ...entries,
  ']);',
  '',
].join('\n'));
