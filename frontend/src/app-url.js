const configuredBaseUrl = import.meta.env.BASE_URL || '/';

export const appBasePath = new URL(configuredBaseUrl, window.location.origin).pathname
  .replace(/\/+$/, '') || '/';

export function appUrl(path = '') {
  const relativePath = String(path).replace(/^\/+/, '');
  const base = appBasePath === '/' ? '/' : `${appBasePath}/`;
  return `${base}${relativePath}`;
}

export function appRelativePath(pathname = window.location.pathname) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';

  if (appBasePath === '/') return normalizedPath;
  if (normalizedPath === appBasePath) return '/';
  if (normalizedPath.startsWith(`${appBasePath}/`)) {
    return normalizedPath.slice(appBasePath.length) || '/';
  }

  return normalizedPath;
}
