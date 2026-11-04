// Resolve Playwright without depending on NODE_PATH, so that the scripts of this skill (and work scripts
// under /tmp) run as `node <script>`.
//
// Order: require('playwright') (NODE_PATH and node_modules above the script), then the directories in
// PLAYWRIGHT_NODE_PATH (path-delimiter separated), /opt/node-tools/node_modules, the global node_modules
// next to the running node, and `npm root -g`.
//
//   const { loadPlaywright } = require('<repo>/.claude/skills/design-game-pictogram-showcase/scripts/playwright_resolve.cjs');
//   const { chromium } = loadPlaywright();
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function searchDirectories() {
  const directories = [];
  if (process.env.PLAYWRIGHT_NODE_PATH) directories.push(...process.env.PLAYWRIGHT_NODE_PATH.split(path.delimiter));
  directories.push('/opt/node-tools/node_modules');
  directories.push(path.resolve(path.dirname(process.execPath), '../lib/node_modules'));
  try {
    directories.push(execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 }).trim());
  } catch {
    // npm is not available; the other directories are enough.
  }
  return [...new Set(directories.filter(Boolean))];
}

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
  }
  const tried = searchDirectories();
  for (const directory of tried) {
    const candidate = path.join(directory, 'playwright');
    if (fs.existsSync(path.join(candidate, 'package.json'))) return require(candidate);
  }
  throw new Error(
    'playwright was not found. Tried require("playwright") and: ' + tried.join(', ') +
      '. Set PLAYWRIGHT_NODE_PATH to the node_modules directory that contains playwright.',
  );
}

module.exports = { loadPlaywright, searchDirectories };
