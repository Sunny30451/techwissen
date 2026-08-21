import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from '../src/db.js';
import { migrateAndSeed } from '../src/migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const articlePath = path.resolve(__dirname, '../content/discord-server-einrichten-contabo-dokploy.md');

const categoryDefinition = {
  name: 'Kommunikation & Collaboration',
  slug: 'kommunikation-collaboration',
  description: 'Kommunikationsplattformen, Collaboration, Chat, Communities, Integrationen und selbst betriebene Zusatzdienste.',
  icon: 'message-circle',
};

const articleDefinition = {
  title: 'Discord-Server einrichten, absichern und mit Contabo/Dokploy integrieren',
  slug: 'discord-server-einrichten-contabo-dokploy',
  excerpt: 'Discord praktisch einrichten: Kanäle, Rollen, Berechtigungen, Community-Sicherheit, Webhooks und optionale Bot- oder n8n-Integrationen über den bestehenden Contabo-/Dokploy-VPS.',
  difficulty: 'Mittel',
  readingTimeMinutes: 30,
  featured: false,
  publishedAt: '2026-08-21T06:00:00+02:00',
  repositoryUrl: null,
  tags: [
    ['Discord', 'discord'],
    ['Community', 'community'],
    ['Rollen', 'rollen'],
    ['Berechtigungen', 'berechtigungen'],
    ['Webhooks', 'webhooks'],
    ['Bot', 'bot'],
    ['n8n', 'n8n'],
    ['Dokploy', 'dokploy'],
    ['Contabo', 'contabo'],
    ['Security', 'security'],
  ],
};

async function importArticle() {
  await migrateAndSeed();
  const content = await readFile(articlePath, 'utf8');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const category = await client.query(
      `INSERT INTO categories (name, slug, description, icon)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         icon = EXCLUDED.icon
       RETURNING id`,
      [categoryDefinition.name, categoryDefinition.slug, categoryDefinition.description, categoryDefinition.icon],
    );

    const article = await client.query(
      `INSERT INTO articles
        (title, slug, excerpt, content_markdown, category_id, difficulty,
         reading_time_minutes, featured, published_at, updated_at, repository_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         excerpt = EXCLUDED.excerpt,
         content_markdown = EXCLUDED.content_markdown,
         category_id = EXCLUDED.category_id,
         difficulty = EXCLUDED.difficulty,
         reading_time_minutes = EXCLUDED.reading_time_minutes,
         featured = EXCLUDED.featured,
         published_at = EXCLUDED.published_at,
         repository_url = EXCLUDED.repository_url,
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
        articleDefinition.repositoryUrl,
      ],
    );

    const articleId = article.rows[0].id;
    await client.query('DELETE FROM article_tags WHERE article_id = $1', [articleId]);

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
    console.log(`Discord-Artikel importiert/aktualisiert: ${article.rows[0].slug}`);
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
  console.error('Discord-Artikel konnte nicht importiert werden:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
