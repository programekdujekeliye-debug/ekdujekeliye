import fs from 'fs';
import path from 'path';

const root = path.resolve(process.cwd());
const outputPath = path.join(root, 'docs', 'CODEBASE_FILE_INVENTORY.md');
const codeExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.css', '.gs', '.ps1']);
const ignoredDirectories = new Set(['.git', '.next', 'node_modules', 'dist', 'build', 'coverage', 'backups', 'CSV', 'Photo']);

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolutePath));
    else if (codeExtensions.has(path.extname(entry.name).toLowerCase())) files.push(absolutePath);
  }
  return files;
}

function normalize(filePath) {
  return path.relative(root, filePath).replaceAll('\\', '/');
}

function areaFor(relativePath) {
  if (relativePath.startsWith('frontend/src/app/')) return 'Frontend routes';
  if (relativePath.startsWith('frontend/src/features/')) return 'Frontend features';
  if (relativePath.startsWith('frontend/src/components/')) return 'Frontend components';
  if (relativePath.startsWith('frontend/src/services/')) return 'Frontend services';
  if (relativePath.startsWith('frontend/src/')) return 'Frontend shared';
  if (relativePath.startsWith('frontend/')) return 'Frontend tooling';
  if (relativePath.startsWith('backend/src/models/')) return 'Backend models';
  if (relativePath.startsWith('backend/src/modules/')) return 'Backend modules';
  if (relativePath.startsWith('backend/src/integrations/')) return 'Backend integrations';
  if (relativePath.startsWith('backend/src/services/')) return 'Backend services';
  if (relativePath.startsWith('backend/src/workers/')) return 'Backend workers';
  if (relativePath.startsWith('backend/src/jobs/')) return 'Backend jobs';
  if (relativePath.startsWith('backend/src/')) return 'Backend platform';
  if (relativePath.startsWith('backend/tests/')) return 'Backend tests';
  if (relativePath.startsWith('backend/scripts/')) return 'Backend operations scripts';
  if (relativePath.startsWith('backend/')) return 'Backend tooling';
  if (relativePath.startsWith('scripts/')) return 'Repository scripts';
  return 'Other code';
}

function compact(values, limit = 6) {
  const unique = [...new Set(values.filter(Boolean))];
  if (unique.length <= limit) return unique.join(', ');
  return `${unique.slice(0, limit).join(', ')} (+${unique.length - limit})`;
}

function describe(relativePath, source) {
  const fileName = path.basename(relativePath);
  const routeMethods = [...source.matchAll(/(?:\w+Router|router|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)/g)]
    .map((match) => `${match[1].toUpperCase()} ${match[2]}`);
  const exports = [...source.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:const|function|class|let|var)?\s*([A-Za-z_$][\w$]*)/g)]
    .map((match) => match[1]);
  const models = [...source.matchAll(/mongoose\.model\(\s*['"`]([^'"`]+)/g)].map((match) => match[1]);

  if (routeMethods.length) return `Routes: ${compact(routeMethods, 8)}`;
  if (models.length) return `MongoDB model: ${compact(models)}`;
  if (fileName === 'page.tsx') return `Next.js page for /${relativePath.replace('frontend/src/app/', '').replace('/page.tsx', '').replace('page.tsx', '')}`;
  if (fileName.endsWith('.test.js') || relativePath.includes('/tests/test_')) return 'Executable regression/integration test';
  if (relativePath.includes('/scripts/')) return 'Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use';
  if (fileName.endsWith('.css')) return 'Global styling, design tokens, responsive safeguards, and shared visual utilities';
  if (exports.length) return `Exports: ${compact(exports)}`;
  return 'Supporting implementation file; inspect imports, callers, and side effects before modification';
}

const records = walk(root)
  .map((absolutePath) => {
    const source = fs.readFileSync(absolutePath, 'utf8');
    const relativePath = normalize(absolutePath);
    return {
      path: relativePath,
      area: areaFor(relativePath),
      lines: source === '' ? 0 : source.split(/\r?\n/).length,
      description: describe(relativePath, source).replaceAll('|', '\\|')
    };
  })
  .sort((a, b) => a.area.localeCompare(b.area) || a.path.localeCompare(b.path));

const totals = new Map();
for (const record of records) {
  const current = totals.get(record.area) || { files: 0, lines: 0 };
  current.files += 1;
  current.lines += record.lines;
  totals.set(record.area, current);
}

const generatedAt = new Date().toISOString();
const lines = [
  '# Codebase File Inventory',
  '',
  `Generated from the repository on ${generatedAt}. This is a mechanical audit index of every code file, excluding dependencies, build output, backups, CSV data, and binary media.`,
  '',
  '## Coverage summary',
  '',
  '| Area | Files | Lines |',
  '|---|---:|---:|',
  ...[...totals.entries()].map(([area, total]) => `| ${area} | ${total.files} | ${total.lines} |`),
  `| **Total** | **${records.length}** | **${records.reduce((sum, item) => sum + item.lines, 0)}** |`,
  '',
  '> This inventory proves coverage and helps locate change surfaces. It does not replace reading a target file and all of its callers before editing.',
  ''
];

for (const [area] of totals) {
  lines.push(`## ${area}`, '', '| File | LOC | Detected responsibility |', '|---|---:|---|');
  for (const record of records.filter((item) => item.area === area)) {
    lines.push(`| \`${record.path}\` | ${record.lines} | ${record.description} |`);
  }
  lines.push('');
}

fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${normalize(outputPath)} with ${records.length} files and ${records.reduce((sum, item) => sum + item.lines, 0)} lines indexed.`);
