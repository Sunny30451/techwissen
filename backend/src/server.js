import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import { pool } from './db.js';
import { migrateAndSeed } from './migrate.js';
import {
  deleteStoredPackage,
  discardTemporaryUpload,
  finalizePackageUpload,
  markdownUpload,
  packageUpload,
  storedPackagePath,
  validateArticleMarkdown,
} from './article-files.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || '';
const adminSessionSecret = process.env.ADMIN_SESSION_SECRET || adminPassword;
const adminTokenLifetimeSeconds = 12 * 60 * 60;
const loginAttempts = new Map();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '4mb' }));

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 220);
}

function safeEqual(left, right) {
  const leftHash = crypto.createHash('sha256').update(String(left)).digest();
  const rightHash = crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signAdminToken() {
  const payload = base64urlJson({
    sub: adminUsername,
    exp: Math.floor(Date.now() / 1000) + adminTokenLifetimeSeconds,
  });
  const signature = crypto.createHmac('sha256', adminSessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyAdminToken(token) {
  if (!token || !adminSessionSecret) return false;
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return false;

  const expected = crypto.createHmac('sha256', adminSessionSecret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.sub === adminUsername && Number(data.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ error: 'Nicht autorisiert' });
  }
  next();
}

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const state = loginAttempts.get(ip);
  if (!state || now - state.startedAt > windowMs) {
    loginAttempts.set(ip, { startedAt: now, failures: 0 });
    return { blocked: false, state: loginAttempts.get(ip) };
  }
  return { blocked: state.failures >= 5, state };
}

function validateCategory(body) {
  const name = String(body.name || '').trim();
  const slug = slugify(body.slug || name);
  const description = String(body.description || '').trim();
  const icon = String(body.icon || 'code').trim().slice(0, 32) || 'code';

  if (name.length < 2 || name.length > 100) throw new Error('Der Kategoriename muss 2 bis 100 Zeichen lang sein.');
  if (!slug) throw new Error('Ein gültiger Slug ist erforderlich.');
  return { name, slug, description, icon };
}

function validateArticle(body) {
  const title = String(body.title || '').trim();
  const slug = slugify(body.slug || title);
  const excerpt = String(body.excerpt || '').trim();
  const contentMarkdown = String(body.content_markdown || '').trim();
  const categoryId = Number(body.category_id);
  const difficulty = String(body.difficulty || 'Einsteiger').trim().slice(0, 30) || 'Einsteiger';
  const readingTimeMinutes = Math.max(1, Math.min(999, Number(body.reading_time_minutes) || 5));
  const featured = Boolean(body.featured);
  const publishedAt = body.published_at ? new Date(body.published_at) : new Date();
  const tagNames = Array.isArray(body.tags)
    ? body.tags.map((tag) => String(typeof tag === 'string' ? tag : tag?.name || '').trim()).filter(Boolean)
    : [];
  const repositoryUrlInput = String(body.repository_url || '').trim();
  let repositoryUrl = null;

  if (repositoryUrlInput) {
    if (repositoryUrlInput.length > 2000) throw new Error('Die Repository-URL ist zu lang.');
    try {
      const parsed = new URL(repositoryUrlInput);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
      repositoryUrl = parsed.toString();
    } catch {
      throw new Error('Die Repository-URL muss eine gültige HTTP- oder HTTPS-URL ohne eingebettete Zugangsdaten sein.');
    }
  }

  if (title.length < 3 || title.length > 220) throw new Error('Der Artikeltitel muss 3 bis 220 Zeichen lang sein.');
  if (!slug) throw new Error('Ein gültiger Slug ist erforderlich.');
  if (excerpt.length < 10) throw new Error('Die Kurzbeschreibung muss mindestens 10 Zeichen enthalten.');
  if (contentMarkdown.length < 20) throw new Error('Der Artikelinhalt ist zu kurz.');
  if (!Number.isInteger(categoryId) || categoryId <= 0) throw new Error('Eine gültige Kategorie ist erforderlich.');
  if (Number.isNaN(publishedAt.getTime())) throw new Error('Das Veröffentlichungsdatum ist ungültig.');

  return {
    title,
    slug,
    excerpt,
    contentMarkdown,
    categoryId,
    difficulty,
    readingTimeMinutes,
    featured,
    publishedAt,
    repositoryUrl,
    tagNames: [...new Set(tagNames)].slice(0, 30),
  };
}

async function syncArticleTags(client, articleId, tagNames) {
  await client.query('DELETE FROM article_tags WHERE article_id = $1', [articleId]);

  for (const name of tagNames) {
    const tagSlug = slugify(name).slice(0, 80);
    if (!tagSlug) continue;
    const tag = await client.query(
      `INSERT INTO tags (name, slug)
       VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [name.slice(0, 80), tagSlug]
    );
    await client.query(
      `INSERT INTO article_tags (article_id, tag_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [articleId, tag.rows[0].id]
    );
  }
}

function sendDatabaseError(error, res, next) {
  if (error.code === '23505') return res.status(409).json({ error: 'Name oder Slug ist bereits vergeben.' });
  if (error.code === '23503') return res.status(409).json({ error: 'Der Datensatz wird noch verwendet und kann nicht gelöscht werden.' });
  next(error);
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.get('/api/categories', async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.slug, c.description, c.icon,
             COUNT(a.id)::int AS article_count
      FROM categories c
      LEFT JOIN articles a ON a.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/articles', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const featured = req.query.featured === 'true';

    const values = [];
    const filters = [];

    if (search) {
      values.push(`%${search}%`);
      filters.push(`(a.title ILIKE $${values.length} OR a.excerpt ILIKE $${values.length} OR a.content_markdown ILIKE $${values.length})`);
    }
    if (category) {
      values.push(category);
      filters.push(`c.slug = $${values.length}`);
    }
    if (featured) filters.push('a.featured = TRUE');

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT a.id, a.title, a.slug, a.excerpt, a.difficulty,
             a.reading_time_minutes, a.featured, a.published_at, a.updated_at,
             a.repository_url, (a.package_storage_name IS NOT NULL) AS has_package,
             c.name AS category_name, c.slug AS category_slug,
             COALESCE(
               json_agg(json_build_object('name', t.name, 'slug', t.slug))
               FILTER (WHERE t.id IS NOT NULL), '[]'
             ) AS tags
      FROM articles a
      JOIN categories c ON c.id = a.category_id
      LEFT JOIN article_tags at ON at.article_id = a.id
      LEFT JOIN tags t ON t.id = at.tag_id
      ${where}
      GROUP BY a.id, c.id
      ORDER BY a.featured DESC, a.published_at DESC
    `, values);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/articles/:slug', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.title, a.slug, a.excerpt, a.content_markdown,
             a.difficulty, a.reading_time_minutes, a.featured,
             a.published_at, a.updated_at, a.repository_url,
             a.package_original_name, a.package_size_bytes, a.package_sha256, a.package_uploaded_at,
             c.name AS category_name, c.slug AS category_slug,
             COALESCE(
               json_agg(json_build_object('name', t.name, 'slug', t.slug))
               FILTER (WHERE t.id IS NOT NULL), '[]'
             ) AS tags
      FROM articles a
      JOIN categories c ON c.id = a.category_id
      LEFT JOIN article_tags at ON at.article_id = a.id
      LEFT JOIN tags t ON t.id = at.tag_id
      WHERE a.slug = $1
      GROUP BY a.id, c.id
    `, [req.params.slug]);

    if (!result.rows.length) return res.status(404).json({ error: 'Artikel nicht gefunden' });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get('/api/articles/:slug/package', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT package_original_name, package_storage_name
       FROM articles WHERE slug = $1`,
      [req.params.slug]
    );
    if (!result.rows.length || !result.rows[0].package_storage_name) {
      return res.status(404).json({ error: 'Für diesen Artikel ist kein Dokploy-Paket hinterlegt.' });
    }

    const article = result.rows[0];
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    res.download(storedPackagePath(article.package_storage_name), article.package_original_name, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Admin authentication
// ---------------------------------------------------------------------------

app.post('/api/admin/login', (req, res) => {
  if (!adminPassword || !adminSessionSecret) {
    return res.status(503).json({ error: 'Adminbereich ist serverseitig noch nicht konfiguriert.' });
  }

  const rate = checkLoginRateLimit(req.ip);
  if (rate.blocked) return res.status(429).json({ error: 'Zu viele fehlgeschlagene Anmeldeversuche. Bitte später erneut versuchen.' });

  const username = String(req.body?.username || '');
  const password = String(req.body?.password || '');
  const valid = safeEqual(username, adminUsername) && safeEqual(password, adminPassword);

  if (!valid) {
    rate.state.failures += 1;
    return res.status(401).json({ error: 'Benutzername oder Passwort ist falsch.' });
  }

  loginAttempts.delete(req.ip);
  res.json({ token: signAdminToken(), username: adminUsername, expires_in: adminTokenLifetimeSeconds });
});

app.get('/api/admin/session', requireAdmin, (_req, res) => {
  res.json({ authenticated: true, username: adminUsername });
});

// ---------------------------------------------------------------------------
// Admin categories
// ---------------------------------------------------------------------------

app.get('/api/admin/categories', requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.slug, c.description, c.icon,
             COUNT(a.id)::int AS article_count
      FROM categories c
      LEFT JOIN articles a ON a.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/categories', requireAdmin, async (req, res, next) => {
  try {
    const category = validateCategory(req.body);
    const result = await pool.query(
      `INSERT INTO categories (name, slug, description, icon)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, slug, description, icon`,
      [category.name, category.slug, category.description, category.icon]
    );
    res.status(201).json({ ...result.rows[0], article_count: 0 });
  } catch (error) {
    if (!error.code) return res.status(400).json({ error: error.message });
    sendDatabaseError(error, res, next);
  }
});

app.put('/api/admin/categories/:id', requireAdmin, async (req, res, next) => {
  try {
    const category = validateCategory(req.body);
    const result = await pool.query(
      `UPDATE categories
       SET name = $1, slug = $2, description = $3, icon = $4
       WHERE id = $5
       RETURNING id, name, slug, description, icon`,
      [category.name, category.slug, category.description, category.icon, Number(req.params.id)]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Kategorie nicht gefunden.' });
    res.json(result.rows[0]);
  } catch (error) {
    if (!error.code) return res.status(400).json({ error: error.message });
    sendDatabaseError(error, res, next);
  }
});

app.delete('/api/admin/categories/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!result.rows.length) return res.status(404).json({ error: 'Kategorie nicht gefunden.' });
    res.status(204).end();
  } catch (error) {
    sendDatabaseError(error, res, next);
  }
});

// ---------------------------------------------------------------------------
// Admin articles
// ---------------------------------------------------------------------------

app.get('/api/admin/articles', requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.title, a.slug, a.excerpt, a.difficulty,
             a.reading_time_minutes, a.featured, a.published_at, a.updated_at,
             a.repository_url, (a.package_storage_name IS NOT NULL) AS has_package,
             a.package_original_name, a.package_size_bytes,
             c.id AS category_id, c.name AS category_name,
             COALESCE(
               json_agg(json_build_object('name', t.name, 'slug', t.slug))
               FILTER (WHERE t.id IS NOT NULL), '[]'
             ) AS tags
      FROM articles a
      JOIN categories c ON c.id = a.category_id
      LEFT JOIN article_tags at ON at.article_id = a.id
      LEFT JOIN tags t ON t.id = at.tag_id
      GROUP BY a.id, c.id
      ORDER BY a.updated_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/articles/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.title, a.slug, a.excerpt, a.content_markdown,
             a.category_id, a.difficulty, a.reading_time_minutes,
             a.featured, a.published_at, a.updated_at, a.repository_url,
             a.package_original_name, a.package_size_bytes, a.package_sha256, a.package_uploaded_at,
             COALESCE(
               json_agg(json_build_object('name', t.name, 'slug', t.slug))
               FILTER (WHERE t.id IS NOT NULL), '[]'
             ) AS tags
      FROM articles a
      LEFT JOIN article_tags at ON at.article_id = a.id
      LEFT JOIN tags t ON t.id = at.tag_id
      WHERE a.id = $1
      GROUP BY a.id
    `, [Number(req.params.id)]);
    if (!result.rows.length) return res.status(404).json({ error: 'Artikel nicht gefunden.' });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/articles', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const article = validateArticle(req.body);
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO articles
       (title, slug, excerpt, content_markdown, category_id, difficulty,
        reading_time_minutes, featured, published_at, repository_url, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING id`,
      [article.title, article.slug, article.excerpt, article.contentMarkdown, article.categoryId,
        article.difficulty, article.readingTimeMinutes, article.featured, article.publishedAt, article.repositoryUrl]
    );
    await syncArticleTags(client, result.rows[0].id, article.tagNames);
    await client.query('COMMIT');
    res.status(201).json({ id: result.rows[0].id, slug: article.slug });
  } catch (error) {
    await client.query('ROLLBACK');
    if (!error.code) return res.status(400).json({ error: error.message });
    sendDatabaseError(error, res, next);
  } finally {
    client.release();
  }
});

app.put('/api/admin/articles/:id', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const article = validateArticle(req.body);
    const articleId = Number(req.params.id);
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE articles
       SET title = $1, slug = $2, excerpt = $3, content_markdown = $4,
           category_id = $5, difficulty = $6, reading_time_minutes = $7,
           featured = $8, published_at = $9, repository_url = $10, updated_at = NOW()
       WHERE id = $11
       RETURNING id`,
      [article.title, article.slug, article.excerpt, article.contentMarkdown, article.categoryId,
        article.difficulty, article.readingTimeMinutes, article.featured, article.publishedAt, article.repositoryUrl, articleId]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Artikel nicht gefunden.' });
    }
    await syncArticleTags(client, articleId, article.tagNames);
    await client.query('COMMIT');
    res.json({ id: articleId, slug: article.slug });
  } catch (error) {
    await client.query('ROLLBACK');
    if (!error.code) return res.status(400).json({ error: error.message });
    sendDatabaseError(error, res, next);
  } finally {
    client.release();
  }
});

app.post('/api/admin/articles/import-markdown', requireAdmin, markdownUpload.single('article'), (req, res, next) => {
  try {
    const validation = validateArticleMarkdown(req.file);
    res.json(validation);
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/articles/:id/package', requireAdmin, packageUpload.single('package'), async (req, res, next) => {
  let newPackage = null;
  try {
    const articleId = Number(req.params.id);
    if (!Number.isInteger(articleId) || articleId <= 0) {
      await discardTemporaryUpload(req.file);
      return res.status(400).json({ error: 'Ungültige Artikel-ID.' });
    }

    const existing = await pool.query(
      `SELECT id, package_storage_name FROM articles WHERE id = $1`,
      [articleId]
    );
    if (!existing.rows.length) {
      await discardTemporaryUpload(req.file);
      return res.status(404).json({ error: 'Artikel nicht gefunden.' });
    }

    newPackage = await finalizePackageUpload(req.file);
    await pool.query(
      `UPDATE articles
       SET package_original_name = $1, package_storage_name = $2, package_mime_type = $3,
           package_size_bytes = $4, package_sha256 = $5, package_uploaded_at = NOW(), updated_at = NOW()
       WHERE id = $6`,
      [newPackage.originalName, newPackage.storageName, newPackage.mimeType, newPackage.sizeBytes, newPackage.sha256, articleId]
    );

    await deleteStoredPackage(existing.rows[0].package_storage_name).catch((error) => {
      console.warn('Altes Artikelpaket konnte nicht entfernt werden:', error.message);
    });
    res.status(201).json({
      original_name: newPackage.originalName,
      size_bytes: newPackage.sizeBytes,
      sha256: newPackage.sha256,
      uploaded_at: new Date().toISOString(),
    });
  } catch (error) {
    if (newPackage?.storageName) await deleteStoredPackage(newPackage.storageName).catch(() => {});
    else await discardTemporaryUpload(req.file);
    next(error);
  }
});

app.delete('/api/admin/articles/:id/package', requireAdmin, async (req, res, next) => {
  try {
    const articleId = Number(req.params.id);
    const existing = await pool.query('SELECT package_storage_name FROM articles WHERE id = $1', [articleId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Artikel nicht gefunden.' });

    await pool.query(
      `UPDATE articles
       SET package_original_name = NULL, package_storage_name = NULL, package_mime_type = NULL,
           package_size_bytes = NULL, package_sha256 = NULL, package_uploaded_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [articleId]
    );
    await deleteStoredPackage(existing.rows[0].package_storage_name).catch((error) => {
      console.warn('Artikelpaket konnte nicht aus dem Dateispeicher entfernt werden:', error.message);
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/articles/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM articles WHERE id = $1 RETURNING id, package_storage_name',
      [Number(req.params.id)]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Artikel nicht gefunden.' });
    await deleteStoredPackage(result.rows[0].package_storage_name).catch((error) => {
      console.warn('Paket eines gelöschten Artikels konnte nicht aus dem Dateispeicher entfernt werden:', error.message);
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route nicht gefunden' });
});

app.use((error, _req, res, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Die hochgeladene Datei überschreitet das erlaubte Größenlimit.' });
  }
  if (error?.code?.startsWith?.('LIMIT_')) {
    return res.status(400).json({ error: 'Der Datei-Upload entspricht nicht den erlaubten Vorgaben.' });
  }
  if (error instanceof Error && /hochgeladen|ZIP|Markdown|UTF-8|Template|\.zip|\.md/i.test(error.message)) {
    return res.status(400).json({ error: error.message });
  }
  console.error(error);
  res.status(500).json({ error: 'Interner Serverfehler' });
});

async function start() {
  try {
    await migrateAndSeed();
    app.listen(port, '0.0.0.0', () => {
      console.log(`TechWissen API läuft auf Port ${port}`);
    });
  } catch (error) {
    console.error('Start fehlgeschlagen:', error);
    process.exit(1);
  }
}

start();
