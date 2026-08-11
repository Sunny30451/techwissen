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

function normalizePathname(value) {
  const raw = String(value || '').trim();
  const clean = `/${raw.replace(/^\/+|\/+$/g, '')}`.replace(/\/{2,}/g, '/');
  return clean === '/' ? '' : clean;
}

function validateConfiguredPath(value) {
  const configured = String(value || '').trim();

  if (/^https?:\/\//i.test(configured)) {
    throw new Error('APP_BASE_URL erwartet nur den Anwendungspfad, z. B. /techwissen, keine vollständige Domain/URL.');
  }

  if (/[?#]/.test(configured)) {
    throw new Error('APP_BASE_URL darf keine Query-Parameter oder URL-Fragmente enthalten. Verwende nur einen Pfad wie /techwissen.');
  }

  const normalized = normalizePathname(configured);
  if (!normalized) {
    throw new Error('APP_BASE_URL muss einen Unterpfad enthalten, z. B. /techwissen.');
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('APP_BASE_URL darf keine relativen Pfadsegmente wie . oder .. enthalten.');
  }

  return normalized;
}

/**
 * APP_BASE_URL is intentionally a path-only setting, e.g. /techwissen.
 * The public hostname and HTTPS termination are owned by Dokploy/Traefik.
 */
export function resolveAppBaseUrl() {
  const configured = String(process.env.APP_BASE_URL || '').trim();
  if (!configured) {
    return `/${resolveRepositoryName()}`;
  }
  return validateConfiguredPath(configured);
}

export function resolveAppBasePath() {
  return resolveAppBaseUrl();
}

if (process.argv.includes('--url')) {
  process.stdout.write(`${resolveAppBaseUrl()}\n`);
} else if (process.argv.includes('--path')) {
  process.stdout.write(`${resolveAppBasePath()}\n`);
} else if (process.argv.includes('--repository')) {
  process.stdout.write(`${resolveRepositoryName()}\n`);
}
