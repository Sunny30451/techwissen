import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const articlePath = path.resolve(__dirname, '../content/dev-container-guide.md');
const ollamaArticlePath = path.resolve(__dirname, '../content/ollama-dokploy-contabo.md');

export async function migrateAndSeed() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      slug VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      icon VARCHAR(32) NOT NULL DEFAULT 'terminal'
    );

    CREATE TABLE IF NOT EXISTS articles (
      id SERIAL PRIMARY KEY,
      title VARCHAR(220) NOT NULL,
      slug VARCHAR(220) NOT NULL UNIQUE,
      excerpt TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      difficulty VARCHAR(30) NOT NULL DEFAULT 'Einsteiger',
      reading_time_minutes INTEGER NOT NULL DEFAULT 5,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      name VARCHAR(80) NOT NULL UNIQUE,
      slug VARCHAR(80) NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS article_tags (
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (article_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
    CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
  `);

  const categories = [
    ['Server & Hosting', 'server-hosting', 'VPS, Linux, Docker, Reverse Proxies und Deployment.', 'server'],
    ['Softwareentwicklung', 'softwareentwicklung', 'Programmiersprachen, Toolchains, IDEs und Entwicklungsworkflows.', 'code'],
    ['Datenbanken', 'datenbanken', 'SQL, Datenmodelle, Persistenz, Backups und Performance.', 'database'],
    ['DevOps', 'devops', 'CI/CD, Container, Automatisierung und Betriebsprozesse.', 'git-branch']
  ];

  for (const category of categories) {
    await pool.query(
      `INSERT INTO categories (name, slug, description, icon)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         icon = EXCLUDED.icon`,
      category
    );
  }

  const content = await readFile(articlePath, 'utf8');
  const category = await pool.query(`SELECT id FROM categories WHERE slug = 'server-hosting'`);

  let article = await pool.query(
    `INSERT INTO articles
      (title, slug, excerpt, content_markdown, category_id, difficulty, reading_time_minutes, featured, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, '2026-08-07T10:00:00+02:00')
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [
      'Universelle Docker-Entwicklungsumgebung auf Contabo mit Dokploy',
      'docker-entwicklungsumgebung-contabo-dokploy',
      'Eine wiederverwendbare Ubuntu-basierte Entwicklungsumgebung mit SSH, VS Code Remote, GitHub CLI, Node.js sowie optionalen Java-, Android- und RDP-Layern.',
      content,
      category.rows[0].id,
      'Fortgeschritten',
      24,
    ]
  );

  if (!article.rows.length) {
    article = await pool.query(
      `SELECT id FROM articles WHERE slug = $1`,
      ['docker-entwicklungsumgebung-contabo-dokploy']
    );
  }

  const tags = [
    ['Docker', 'docker'],
    ['Ubuntu', 'ubuntu'],
    ['Dokploy', 'dokploy'],
    ['VS Code', 'vs-code'],
    ['SSH', 'ssh'],
    ['Node.js', 'nodejs'],
    ['Contabo', 'contabo']
  ];

  for (const tag of tags) {
    const inserted = await pool.query(
      `INSERT INTO tags (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      tag
    );
    await pool.query(
      `INSERT INTO article_tags (article_id, tag_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [article.rows[0].id, inserted.rows[0].id]
    );
  }

  // Zweiter quellversionierter TechWissen-Artikel: Ollama auf Dokploy.
  // ON CONFLICT DO NOTHING bewahrt spätere redaktionelle Änderungen in der DB.
  const ollamaContent = await readFile(ollamaArticlePath, 'utf8');

  let ollamaArticle = await pool.query(
    `INSERT INTO articles
      (title, slug, excerpt, content_markdown, category_id, difficulty,
       reading_time_minutes, featured, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, '2026-08-09T12:00:00+02:00')
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [
      'Ollama sicher mit Docker und Dokploy auf einem Contabo VPS bereitstellen',
      'ollama-docker-dokploy-contabo-intern',
      'Ollama als zentralen internen LLM-Dienst auf einem Contabo-VPS deployen: Docker Compose, Dokploy, persistente Modelle und ein dediziertes Netzwerk für andere Container – ohne öffentliche API.',
      ollamaContent,
      category.rows[0].id,
      'Fortgeschritten',
      30,
    ]
  );

  if (!ollamaArticle.rows.length) {
    ollamaArticle = await pool.query(
      `SELECT id FROM articles WHERE slug = $1`,
      ['ollama-docker-dokploy-contabo-intern']
    );
  }

  const ollamaTags = [
    ['Ollama', 'ollama'],
    ['Docker', 'docker'],
    ['Dokploy', 'dokploy'],
    ['Contabo', 'contabo'],
    ['LLM', 'llm'],
    ['REST API', 'rest-api'],
    ['Docker Networking', 'docker-networking']
  ];

  for (const tag of ollamaTags) {
    const inserted = await pool.query(
      `INSERT INTO tags (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      tag
    );
    await pool.query(
      `INSERT INTO article_tags (article_id, tag_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [ollamaArticle.rows[0].id, inserted.rows[0].id]
    );
  }
}
