import { appUrl } from './config.js';

async function request(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) return null;

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export function getCategories() {
  return request(appUrl(`/api/categories`));
}

export function getArticles({ search = '', category = '', featured = false } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (featured) params.set('featured', 'true');
  const suffix = params.toString() ? `?${params}` : '';
  return request(appUrl(`/api/articles${suffix}`));
}

export function getArticle(slug) {
  return request(appUrl(`/api/articles/${encodeURIComponent(slug)}`));
}

function adminHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export function adminLogin(username, password) {
  return request(appUrl(`/api/admin/login`), {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function getAdminSession(token) {
  return request(appUrl(`/api/admin/session`), { headers: adminHeaders(token) });
}

export function getAdminCategories(token) {
  return request(appUrl(`/api/admin/categories`), { headers: adminHeaders(token) });
}

export function createAdminCategory(token, category) {
  return request(appUrl(`/api/admin/categories`), {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify(category),
  });
}

export function updateAdminCategory(token, id, category) {
  return request(appUrl(`/api/admin/categories/${id}`), {
    method: 'PUT',
    headers: adminHeaders(token),
    body: JSON.stringify(category),
  });
}

export function deleteAdminCategory(token, id) {
  return request(appUrl(`/api/admin/categories/${id}`), {
    method: 'DELETE',
    headers: adminHeaders(token),
  });
}

export function getAdminArticles(token) {
  return request(appUrl(`/api/admin/articles`), { headers: adminHeaders(token) });
}

export function getAdminArticle(token, id) {
  return request(appUrl(`/api/admin/articles/${id}`), { headers: adminHeaders(token) });
}

export function createAdminArticle(token, article) {
  return request(appUrl(`/api/admin/articles`), {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify(article),
  });
}

export function updateAdminArticle(token, id, article) {
  return request(appUrl(`/api/admin/articles/${id}`), {
    method: 'PUT',
    headers: adminHeaders(token),
    body: JSON.stringify(article),
  });
}

export function deleteAdminArticle(token, id) {
  return request(appUrl(`/api/admin/articles/${id}`), {
    method: 'DELETE',
    headers: adminHeaders(token),
  });
}

export function importAdminArticleMarkdown(token, file) {
  const body = new FormData();
  body.append('article', file);
  return request(appUrl(`/api/admin/articles/import-markdown`), {
    method: 'POST',
    headers: adminHeaders(token),
    body,
  });
}

export function uploadAdminArticlePackage(token, id, file) {
  const body = new FormData();
  body.append('package', file);
  return request(appUrl(`/api/admin/articles/${id}/package`), {
    method: 'POST',
    headers: adminHeaders(token),
    body,
  });
}

export function deleteAdminArticlePackage(token, id) {
  return request(appUrl(`/api/admin/articles/${id}/package`), {
    method: 'DELETE',
    headers: adminHeaders(token),
  });
}
