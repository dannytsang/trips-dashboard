const PRIVATE_DATA_PATTERNS = [
  /google_calendar:[^\s"']+/i,
  /device_tracker\./i,
  /person\./i,
  /\b(latitude|longitude)\b/i,
];

const fs = require('node:fs');
const path = require('node:path');

const roots = ['.next/static', '.next/server/app'];
const publicExtensions = new Set(['.html', '.rsc', '.js', '.css', '.json']);
const findings = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!publicExtensions.has(path.extname(fullPath))) continue;

    const text = fs.readFileSync(fullPath, 'utf8');
    for (const pattern of PRIVATE_DATA_PATTERNS) {
      if (pattern.test(text)) {
        findings.push(`${fullPath}: matched ${pattern}`);
      }
    }
  }
}

for (const root of roots) {
  walk(root);
}

if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log('No private trip data patterns found in built public dashboard assets.');
