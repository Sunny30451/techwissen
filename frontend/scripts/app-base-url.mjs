import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const frontendDir = path.resolve(path.dirname(currentFile), '..');

function normalizeRepositoryName(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/$/, '')
    .split('/')
    .pop()
    .replace(/\.git$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function repositoryNameFromGitConfig(startDir) {
  let directory = path.resolve(startDir);

  while (true) {
    const gitConfig = path.join(directory, '.git', 'config');
    if (fs.existsSync(gitConfig)) {
      const config = fs.readFileSync(gitConfig, 'utf8');
      const originSection = config.match(/\[remote\s+"origin"\]([\s\S]*?)(?=\n\[|$)/i);
      const urlMatch = originSection?.[1]?.match(/^\s*url\s*=\s*(.+)$/im);
      const repositoryName = normalizeRepositoryName(urlMatch?.[1]);
      if (repositoryName) return repositoryName;
    }

    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  return '';
}

function repositoryNameFromPackage() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(frontendDir, 'package.json'), 'utf8'));
  return normalizeRepositoryName(packageJson.repositoryName || packageJson.name?.replace(/-frontend$/i, ''));
}

export function resolveRepositoryName() {
  return repositoryNameFromGitConfig(frontendDir) || repositoryNameFromPackage() || 'app';
}

function normalizePathname(pathname) {
  const clean = `/${String(pathname || '').replace(/^\/+|\/+$/g, '')}`;
  return clean === '/' ? '' : clean;
}

export function resolveAppBaseUrl() {
  const configured = String(process.env.APP_BASE_URL || '').trim();

  if (!configured) {
    return `/${resolveRepositoryName()}`;
  }

  let parsed;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error('APP_BASE_URL muss eine vollständige http:// oder https:// URL sein, z. B. https://example.com/techwissen.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('APP_BASE_URL unterstützt ausschließlich http:// oder https:// URLs.');
  }

  parsed.hash = '';
  parsed.search = '';
  const normalizedPath = normalizePathname(parsed.pathname);
  if (!normalizedPath) {
    throw new Error('APP_BASE_URL muss einen Anwendungspfad enthalten, z. B. https://example.com/techwissen.');
  }
  parsed.pathname = normalizedPath;

  return parsed.toString().replace(/\/$/, '');
}

export function resolveAppBasePath() {
  const resolved = resolveAppBaseUrl();
  if (resolved.startsWith('/')) return normalizePathname(resolved);
  return normalizePathname(new URL(resolved).pathname);
}

if (process.argv.includes('--url')) {
  process.stdout.write(`${resolveAppBaseUrl()}\n`);
} else if (process.argv.includes('--path')) {
  process.stdout.write(`${resolveAppBasePath()}\n`);
} else if (process.argv.includes('--repository')) {
  process.stdout.write(`${resolveRepositoryName()}\n`);
}
