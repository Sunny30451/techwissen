import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from '../src/db.js';
import { migrateAndSeed } from '../src/migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const articlePath = path.resolve(
  __dirname,
  '../content/ollama-dokploy-contabo.md',
);

const articleDefinition = {
  title: 'Ollama sicher mit Docker und Dokploy auf einem Contabo VPS bereitstellen',
  slug: 'ollama-docker-dokploy-contabo-intern',
  excerpt:
    'Ollama als zentralen internen LLM-Dienst auf einem Contabo-VPS deployen: Docker Compose, Dokploy, persistente Modelle und ein dediziertes Netzwerk für andere Container – ohne öffentliche API.',
  categorySlug: 'server-hosting',
  difficulty: 'Fortgeschritten',
  readingTimeMinutes: 30,
  featured: false,
  publishedAt: '2026-08-09T12:00:00+02:00',
  tags: [
    ['Ollama', 'ollama'],
    ['Docker', 'docker'],
    ['Dokploy', 'dokploy'],
    ['Contabo', 'contabo'],
    ['LLM', 'llm'],
    ['REST API', 'rest-api'],
    ['Docker Networking', 'docker-networking'],
  ],
};

async function importArticle() {
  // Stellt sicher, dass Tabellen und Grundkategorien existieren.
  await migrateAndSeed();

  const content = await readFile(articlePath, 'utf8');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const category = await client.query(
      'SELECT id FROM categories WHERE slug = $1',
      [articleDefinition.categorySlug],
    );

    if (!category.rows.length) {
      throw new Error(
        `Kategorie ${articleDefinition.categorySlug} wurde nicht gefunden.`,
      );
    }

    const article = await client.query(
      `INSERT INTO articles
        (title, slug, excerpt, content_markdown, category_id, difficulty,
         reading_time_minutes, featured, published_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         excerpt = EXCLUDED.excerpt,
         content_markdown = EXCLUDED.content_markdown,
         category_id = EXCLUDED.category_id,
         difficulty = EXCLUDED.difficulty,
         reading_time_minutes = EXCLUDED.reading_time_minutes,
         featured = EXCLUDED.featured,
         published_at = EXCLUDED.published_at,
         updated_at = NOW()
       RETURNING id, slug`,
      [
        articleDefinition.title,
        articleDefinition.slug,
        articleDefinition.excerpt,
        content,
        category.rows[0].id,
        articleDefinition.difficulty,
        articleDefinition.readingTimeMinutes,
        articleDefinition.featured,
        articleDefinition.publishedAt,
      ],
    );

    const articleId = article.rows[0].id;

    // Tags werden synchronisiert: alte Zuordnungen entfernen, gewünschte neu setzen.
    await client.query('DELETE FROM article_tags WHERE article_id = $1', [
      articleId,
    ]);

    for (const [name, slug] of articleDefinition.tags) {
      const tag = await client.query(
        `INSERT INTO tags (name, slug)
         VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [name, slug],
      );

      await client.query(
        `INSERT INTO article_tags (article_id, tag_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [articleId, tag.rows[0].id],
      );
    }

    await client.query('COMMIT');

    console.log(
      `Artikel erfolgreich veröffentlicht/aktualisiert: ${article.rows[0].slug}`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

try {
  await importArticle();
} catch (error) {
  console.error('Ollama-Artikel konnte nicht importiert werden:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
