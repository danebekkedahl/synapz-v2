#!/usr/bin/env node
/**
 * SYNAPZ GLOBAL V2 — Isolated GitHub Pages Deployment Script
 * Target Repo: https://github.com/danebekkedahl/synapz-v2
 * Live Pages:  https://danebekkedahl.github.io/synapz-v2/
 *
 * HARD ISOLATION MANDATE:
 * - Refuses to run outside Synapz-Global-V2.
 * - Hard-aborts if ANY git remote URL does not end strictly with `/synapz-v2` or `/synapz-v2.git`.
 * - Never touches, reads, or pushes to `synapz-hockey`, `tactix-hockey`, or `synapz-hockey-rush`.
 * - Resolves GitHub auth strictly in memory via env, `gh`, or `git credential fill` (never logged or saved to disk).
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OWNER = 'danebekkedahl';
const REPO = 'synapz-v2';
const EXPECTED_REPO_FULL = `${OWNER}/${REPO}`;
const CLEAN_REMOTE_URL = `https://github.com/${EXPECTED_REPO_FULL}.git`;
const LIVE_PAGES_URL = `https://${OWNER}.github.io/${REPO}/`;
const FORBIDDEN_REPOS = ['synapz-hockey', 'tactix-hockey', 'synapz-hockey-rush'];

function resolveBinary(binName, fallbackWinPaths) {
  const probe = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [binName], {
    encoding: 'utf8',
  });
  if (probe.status === 0 && probe.stdout.trim()) {
    return probe.stdout.trim().split(/\r?\n/)[0].trim();
  }
  for (const candidate of fallbackWinPaths) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return binName;
}

const localAppData = process.env.LOCALAPPDATA || '';
const GIT_BIN = resolveBinary('git', [
  path.join(localAppData, 'Programs', 'git', 'cmd', 'git.exe'),
  'C:\\Program Files\\Git\\cmd\\git.exe',
]);
const GH_BIN = resolveBinary('gh', [
  path.join(localAppData, 'Programs', 'gh', 'bin', 'gh.exe'),
  'C:\\Program Files\\GitHub CLI\\gh.exe',
]);

function assertAllowedRemoteUrl(url, contextLabel) {
  const trimmed = String(url || '').trim();
  if (!trimmed) {
    throw new Error(`[HARD ABORT] Empty remote URL in ${contextLabel}.`);
  }
  const lower = trimmed.toLowerCase();
  for (const forbidden of FORBIDDEN_REPOS) {
    if (lower.includes(forbidden)) {
      throw new Error(
        `[HARD ISOLATION ABORT] Forbidden repository "${forbidden}" detected in ${contextLabel}: ${trimmed}`
      );
    }
  }
  const validSuffix =
    trimmed.endsWith(`/${REPO}`) || trimmed.endsWith(`/${REPO}.git`) || trimmed.endsWith(`:${EXPECTED_REPO_FULL}.git`);
  if (!validSuffix) {
    throw new Error(
      `[HARD ISOLATION ABORT] Remote URL in ${contextLabel} ("${trimmed}") does NOT end with /${REPO} or /${REPO}.git!`
    );
  }
}

function assertWorkspaceIsolation(cwd) {
  const normalized = cwd.replace(/\\/g, '/');
  for (const forbidden of FORBIDDEN_REPOS) {
    if (normalized.toLowerCase().includes(forbidden)) {
      throw new Error(`[HARD ISOLATION ABORT] Refusing to run inside forbidden workspace: ${cwd}`);
    }
  }
  if (!normalized.endsWith('/Synapz-Global-V2')) {
    throw new Error(
      `[HARD ISOLATION ABORT] Deploy script must run strictly from Synapz-Global-V2 root. Current: ${cwd}`
    );
  }
}

function runGit(args, options = {}) {
  return execFileSync(GIT_BIN, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    env: options.env || process.env,
  }).trim();
}

function verifyAllExistingRemotes(cwd) {
  if (!fs.existsSync(path.join(cwd, '.git'))) return;
  const out = runGit(['remote', '-v'], { cwd });
  if (!out) return;
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.trim().split(/\s+/);
    if (parts[1]) {
      assertAllowedRemoteUrl(parts[1], `git remote "${parts[0]}"`);
    }
  }
}

function resolveGithubTokenInMemory() {
  const envToken = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '').trim();
  if (envToken) return { token: envToken, source: 'env' };

  const ghProbe = spawnSync(GH_BIN, ['auth', 'token'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (ghProbe.status === 0 && ghProbe.stdout.trim()) {
    return { token: ghProbe.stdout.trim(), source: 'gh-cli' };
  }

  const credProbe = spawnSync(GIT_BIN, ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    timeout: 4000,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
  });
  if (credProbe.status === 0 && credProbe.stdout) {
    const pwMatch = credProbe.stdout.match(/^password=(.+)$/m);
    if (pwMatch && pwMatch[1].trim()) {
      return { token: pwMatch[1].trim(), source: 'git-credential-fill' };
    }
  }

  return null;
}

async function githubApi(endpoint, token, method = 'GET', body = undefined) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'synapz-v2-deploy-script',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, json };
}

function gitPushWithMemoryToken(cwd, token, refspec, force = false) {
  const remoteUrl = runGit(['remote', 'get-url', 'origin'], { cwd });
  assertAllowedRemoteUrl(remoteUrl, 'pre-push origin verification');

  const basicB64 = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
  const args = [
    '-c',
    `http.https://github.com/.extraheader=AUTHORIZATION: basic ${basicB64}`,
    'push',
    ...(force ? ['--force'] : ['-u']),
    'origin',
    refspec,
  ];
  execFileSync(GIT_BIN, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
}

async function ensureRepoExists(token) {
  const check = await githubApi(`/repos/${EXPECTED_REPO_FULL}`, token, 'GET');
  if (check.status === 200) {
    console.log(`[1/5] Verified target repository exists: ${EXPECTED_REPO_FULL}`);
    return;
  }
  if (check.status !== 404) {
    throw new Error(`GitHub API /repos/${EXPECTED_REPO_FULL} returned HTTP ${check.status}`);
  }
  console.log(`[1/5] Creating public repository ${EXPECTED_REPO_FULL}...`);
  const created = await githubApi('/user/repos', token, 'POST', {
    name: REPO,
    private: false,
    description: 'SYNAPZ Hockey V2 — Universal PC, Tablet & Phone Off-Ice Hockey IQ Studio',
    has_issues: true,
    auto_init: false,
  });
  if (!created.ok) {
    throw new Error(`Failed to create ${EXPECTED_REPO_FULL}: HTTP ${created.status}`);
  }
  console.log(`[1/5] Created public repository: https://github.com/${EXPECTED_REPO_FULL}`);
}

async function enablePages(token) {
  const check = await githubApi(`/repos/${EXPECTED_REPO_FULL}/pages`, token, 'GET');
  if (check.status === 404) {
    const enableRes = await githubApi(`/repos/${EXPECTED_REPO_FULL}/pages`, token, 'POST', {
      source: { branch: 'gh-pages', path: '/' },
    });
    if (!enableRes.ok && enableRes.status !== 409) {
      throw new Error(`Failed enabling GitHub Pages: HTTP ${enableRes.status}`);
    }
    console.log(`[4/5] Enabled GitHub Pages on gh-pages (/).`);
  } else {
    await githubApi(`/repos/${EXPECTED_REPO_FULL}/pages`, token, 'PUT', {
      source: { branch: 'gh-pages', path: '/' },
    });
    console.log(`[4/5] Confirmed GitHub Pages source: gh-pages (/).`);
  }
}

async function pollLivePagesUrl(maxAttempts = 30, intervalMs = 4000) {
  console.log(`[5/5] Polling ${LIVE_PAGES_URL} for HTTP 200...`);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${LIVE_PAGES_URL}?v=${Date.now()}`, { method: 'GET' });
      if (res.status === 200) {
        console.log(`[5/5] LIVE HTTP 200 confirmed on attempt ${attempt}: ${LIVE_PAGES_URL}`);
        return true;
      }
      console.log(`      Attempt ${attempt}/${maxAttempts}: HTTP ${res.status} (building...)`);
    } catch {
      console.log(`      Attempt ${attempt}/${maxAttempts}: network pending...`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function main() {
  const rootDir = process.cwd();
  assertWorkspaceIsolation(rootDir);
  verifyAllExistingRemotes(rootDir);

  const distDir = path.join(rootDir, 'dist');
  const distIndex = path.join(distDir, 'index.html');
  if (!fs.existsSync(distIndex)) {
    throw new Error('Missing dist/index.html — run `npm run build` before deploying.');
  }
  fs.writeFileSync(path.join(distDir, '.nojekyll'), '');

  // Ensure local git repository on `main` with strictly validated remote URL
  if (!fs.existsSync(path.join(rootDir, '.git'))) {
    runGit(['init', '-b', 'main'], { cwd: rootDir });
  }
  try {
    const currentOrigin = runGit(['remote', 'get-url', 'origin'], { cwd: rootDir });
    assertAllowedRemoteUrl(currentOrigin, 'origin');
  } catch (err) {
    if (String(err.message || '').includes('HARD ISOLATION ABORT')) throw err;
    runGit(['remote', 'add', 'origin', CLEAN_REMOTE_URL], { cwd: rootDir });
  }
  verifyAllExistingRemotes(rootDir);

  // Ensure local git commit identity exists locally inside Synapz-Global-V2
  try {
    runGit(['config', 'user.name'], { cwd: rootDir });
  } catch {
    runGit(['config', 'user.name', 'Dane Bekkedahl'], { cwd: rootDir });
    runGit(['config', 'user.email', 'danebekkedahl@users.noreply.github.com'], { cwd: rootDir });
  }

  runGit(['add', '-A'], { cwd: rootDir });
  const statusOut = runGit(['status', '--porcelain'], { cwd: rootDir });
  if (statusOut) {
    runGit(['commit', '-m', 'SYNAPZ Hockey V2.0 — Universal PC, Tablet & Phone Studio'], {
      cwd: rootDir,
    });
  }

  const auth = resolveGithubTokenInMemory();
  if (!auth) {
    console.error(
      '[AUTH REQUIRED] Local git commit + dist/.nojekyll ready, but no GitHub credentials found in GH_TOKEN, `gh auth status`, or `git credential fill`.'
    );
    console.error(`Run: "${GH_BIN}" auth login --web -h github.com -p https`);
    process.exit(2);
  }
  console.log(`[0/5] Authenticated in memory via ${auth.source} (credentials never written to disk).`);

  await ensureRepoExists(auth.token);

  console.log('[2/5] Pushing clean source branch `main` to danebekkedahl/synapz-v2...');
  runGit(['branch', '-M', 'main'], { cwd: rootDir });
  gitPushWithMemoryToken(rootDir, auth.token, 'main:main', false);

  console.log('[3/5] Force-pushing ONLY dist/ (+ .nojekyll) to `gh-pages`...');
  const tmpPagesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapz-v2-gh-pages-'));
  try {
    fs.cpSync(distDir, tmpPagesDir, { recursive: true });
    fs.writeFileSync(path.join(tmpPagesDir, '.nojekyll'), '');
    runGit(['init', '-b', 'gh-pages'], { cwd: tmpPagesDir });
    runGit(['config', 'user.name', 'Dane Bekkedahl'], { cwd: tmpPagesDir });
    runGit(['config', 'user.email', 'danebekkedahl@users.noreply.github.com'], { cwd: tmpPagesDir });
    runGit(['remote', 'add', 'origin', CLEAN_REMOTE_URL], { cwd: tmpPagesDir });
    assertAllowedRemoteUrl(runGit(['remote', 'get-url', 'origin'], { cwd: tmpPagesDir }), 'gh-pages origin');
    runGit(['add', '-A'], { cwd: tmpPagesDir });
    runGit(['commit', '-m', 'Deploy SYNAPZ V2 dist/ to gh-pages'], { cwd: tmpPagesDir });
    gitPushWithMemoryToken(tmpPagesDir, auth.token, 'gh-pages:gh-pages', true);
  } finally {
    fs.rmSync(tmpPagesDir, { recursive: true, force: true });
  }

  await enablePages(auth.token);
  const liveOk = await pollLivePagesUrl();
  if (!liveOk) {
    throw new Error(`Timed out waiting for HTTP 200 at ${LIVE_PAGES_URL}`);
  }
  console.log(`\nSUCCESS! SYNAPZ V2 Live URL: ${LIVE_PAGES_URL}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
