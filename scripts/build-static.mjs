import { cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const outputDir = resolve(root, 'dist');

await rm(outputDir, { recursive: true, force: true });
await cp(publicDir, outputDir, { recursive: true });

console.log('Built static dashboard shell to dist/.');
