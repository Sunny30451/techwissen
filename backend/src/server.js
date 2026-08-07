import express from 'express';
import helmet from 'helmet';
import { pool } from './db.js';
import { migrateAndSeed } from './migrate.js';

const app = express();
const port = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '200kb' }));

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
    if (featured) {
      filters.push('a.featured = TRUE');
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT a.id, a.title, a.slug, a.excerpt, a.difficulty,
             a.reading_time_minutes, a.featured, a.published_at, a.updated_at,
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
             a.published_at, a.updated_at,
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

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route nicht gefunden' });
});

app.use((error, _req, res, _next) => {
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
