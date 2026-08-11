const viteBase = import.meta.env.BASE_URL || '/';

export const APP_BASE_PATH = viteBase === '/'
  ? ''
  : `/${viteBase.replace(/^\/+|\/+$/g, '')}`;

export function appUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${APP_BASE_PATH}${normalizedPath}` || '/';
}

export function stripAppBasePath(pathname) {
  if (!APP_BASE_PATH) return pathname || '/';
  if (pathname === APP_BASE_PATH) return '/';
  if (pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length) || '/';
  }
  return pathname || '/';
}
