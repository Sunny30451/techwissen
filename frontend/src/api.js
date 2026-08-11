import { APP_BASE_PATH } from './config.js';

async function request(path, options = {}) {
  const response = await fetch(`${APP_BASE_PATH}`/path, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
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
  return request(`${APP_BASE_PATH}/api/categories`);
}

export function getArticles({ search = '', category = '', featured = false } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (featured) params.set('featured', 'true');
  const suffix = params.toString() ? `?${params}` : '';
  return request(`${APP_BASE_PATH}/api/articles${suffix}`);
}

export function getArticle(slug) {
  return request(`${APP_BASE_PATH}/api/articles/${encodeURIComponent(slug)}`);
}

function adminHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export function adminLogin(username, password) {
  return request(`${APP_BASE_PATH}/api/admin/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function getAdminSession(token) {
  return request(`${APP_BASE_PATH}/api/admin/session`, { headers: adminHeaders(token) });
}

export function getAdminCategories(token) {
  return request(`${APP_BASE_PATH}/api/admin/categories`, { headers: adminHeaders(token) });
}

export function createAdminCategory(token, category) {
  return request(`${APP_BASE_PATH}/api/admin/categories`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify(category),
  });
}

export function updateAdminCategory(token, id, category) {
  return request(`${APP_BASE_PATH}/api/admin/categories/${id}`, {
    method: 'PUT',
    headers: adminHeaders(token),
    body: JSON.stringify(category),
  });
}

export function deleteAdminCategory(token, id) {
  return request(`${APP_BASE_PATH}/api/admin/categories/${id}`, {
    method: 'DELETE',
    headers: adminHeaders(token),
  });
}

export function getAdminArticles(token) {
  return request(`${APP_BASE_PATH}/api/admin/articles`, { headers: adminHeaders(token) });
}

export function getAdminArticle(token, id) {
  return request(`${APP_BASE_PATH}/api/admin/articles/${id}`, { headers: adminHeaders(token) });
}

export function createAdminArticle(token, article) {
  return request(`${APP_BASE_PATH}/api/admin/articles`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify(article),
  });
}

export function updateAdminArticle(token, id, article) {
  return request(`${APP_BASE_PATH}/api/admin/articles/${id}`, {
    method: 'PUT',
    headers: adminHeaders(token),
    body: JSON.stringify(article),
  });
}

export function deleteAdminArticle(token, id) {
  return request(`${APP_BASE_PATH}/api/admin/articles/${id}`, {
    method: 'DELETE',
    headers: adminHeaders(token),
  });
}
