import { appUrl } from './app-url.js';

async function request(path) {
  const response = await fetch(appUrl(path), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export function getCategories() {
  return request('api/categories');
}

export function getArticles({ search = '', category = '', featured = false } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (featured) params.set('featured', 'true');
  const suffix = params.toString() ? `?${params}` : '';
  return request(`api/articles${suffix}`);
}

export function getArticle(slug) {
  return request(`api/articles/${encodeURIComponent(slug)}`);
}
