import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

execFileSync('npx', ['expo', 'export', '--platform', 'web'], { stdio: 'inherit' });

const htmlPath = 'dist/index.html';
const html = readFileSync(htmlPath, 'utf8');
const pwaHead = `
    <link rel="manifest" href="./manifest.json" />
    <meta name="theme-color" content="#f6f7f1" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />
    <script>
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => undefined);
      }
    </script>`;

if (!html.includes('rel="manifest"')) {
  writeFileSync(htmlPath, html.replace('</head>', `${pwaHead}\n  </head>`));
}

function listFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = `${prefix}${entry.name}`;
    const absolutePath = `${directory}/${entry.name}`;
    return entry.isDirectory() ? listFiles(absolutePath, `${relativePath}/`) : [`./${relativePath}`];
  });
}

const swPath = 'dist/sw.js';
const precacheFiles = listFiles('dist').filter(file => file !== './sw.js');
const serviceWorker = readFileSync(swPath, 'utf8').replace(
  'const PRECACHE_FILES = null;',
  `const PRECACHE_FILES = ${JSON.stringify(precacheFiles)};`
);
writeFileSync(swPath, serviceWorker);
