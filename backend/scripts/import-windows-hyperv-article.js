import { readFile, mkdir, copyFile, unlink, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from '../src/db.js';
import { migrateAndSeed } from '../src/migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const articlePath = path.resolve(__dirname, '../content/windows-hyperv-contabo.md');
const packagePath = path.resolve(__dirname, '../packages/windows-hyperv-toolkit.zip');
const uploadDir = process.env.ARTICLE_UPLOAD_DIR || '/app/uploads/article-packages';

const categoryDefinition = {
  name: 'Server & Hosting',
  slug: 'server-hosting',
  description: 'Serverbetrieb, Hosting, Container, Virtualisierung, Netzwerkdienste und selbst gehostete Infrastruktur.',
  icon: 'server',
};

const articleDefinition = {
  title: 'Windows Hyper-V und virtuelle Maschinen auf Contabo einrichten',
  slug: 'windows-hyper-v-virtual-machines-contabo',
  excerpt: 'Hyper-V auf Contabo richtig planen und betreiben: Produktauswahl, Windows Server, Hyper-V-Rolle, internes NAT-Netz, VM-Erstellung, Portweiterleitungen, Sicherheit und Backup.',
  difficulty: 'Fortgeschritten',
  readingTimeMinutes: 38,
  featured: false,
  publishedAt: '2026-08-13T11:30:00+02:00',
  repositoryUrl: null,
  tags: [
    ['Windows Server', 'windows-server'],
    ['Hyper-V', 'hyper-v'],
    ['Virtualisierung', 'virtualisierung'],
    ['Virtuelle Maschinen', 'virtuelle-maschinen'],
    ['Contabo', 'contabo'],
    ['PowerShell', 'powershell'],
    ['Windows', 'windows'],
    ['Networking', 'networking'],
    ['NAT', 'nat'],
    ['Backup', 'backup'],
  ],
};

async function attachPackage(client, articleId) {
  const bytes = await readFile(packagePath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const storageName = `${articleId}-${sha256.slice(0, 20)}.zip`;
  const target = path.join(uploadDir, storageName);

  await mkdir(uploadDir, { recursive: true });
  await copyFile(packagePath, target);
  const info = await stat(target);

  const old = await client.query(
    'SELECT package_storage_name FROM articles WHERE id = $1',
    [articleId],
  );
  const oldName = old.rows[0]?.package_storage_name;

  await client.query(
    `UPDATE articles SET
       package_original_name = $2,
       package_storage_name = $3,
       package_mime_type = 'application/zip',
       package_size_bytes = $4,
       package_sha256 = $5,
       package_uploaded_at = NOW(),
       updated_at = NOW()
     WHERE id = $1`,
    [articleId, 'windows-hyperv-toolkit.zip', storageName, info.size, sha256],
  );

  if (oldName && oldName !== storageName) {
    await unlink(path.join(uploadDir, oldName)).catch(() => {});
  }
}

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
        `INSERT INTO tags (name, slug) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [name, slug],
      );
      await client.query(
        `INSERT INTO article_tags (article_id, tag_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [articleId, tag.rows[0].id],
      );
    }

    await attachPackage(client, articleId);
    await client.query('COMMIT');
    console.log(`Windows-Hyper-V-Artikel und PowerShell-Paket importiert: ${article.rows[0].slug}`);
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
  console.error('Windows-Hyper-V-Artikel konnte nicht importiert werden:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
