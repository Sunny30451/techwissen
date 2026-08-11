export const APP_BASE_URL = __APP_BASE_URL__.replace(/\/$/, '');

function baseUrl() {
  return new URL(`${APP_BASE_URL}/`, window.location.origin);
}

export function appUrl(path = '/') {
  const normalizedPath = String(path || '/').replace(/^\/+/, '');
  return new URL(normalizedPath, baseUrl()).toString();
}

export function stripAppBaseUrl(pathname) {
  const basePath = baseUrl().pathname.replace(/\/$/, '');
  if (!basePath) return pathname || '/';
  if (pathname === basePath) return '/';
  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length) || '/';
  }
  return pathname || '/';
}
