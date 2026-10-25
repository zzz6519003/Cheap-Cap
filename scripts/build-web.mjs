import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

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
        window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
      }
    </script>`;

if (!html.includes('rel="manifest"')) {
  writeFileSync(htmlPath, html.replace('</head>', `${pwaHead}\n  </head>`));
}
