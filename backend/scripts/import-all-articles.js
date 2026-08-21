import {
  access,
  copyFile,
  mkdir,
  readFile,
  stat,
  unlink,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from '../src/db.js';
import { migrateAndSeed } from '../src/migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(__dirname, '../content');
const packageDir = path.resolve(__dirname, '../packages');
const uploadDir =
  process.env.ARTICLE_UPLOAD_DIR || '/app/uploads/article-packages';

const SERVER_HOSTING = {
  name: 'Server & Hosting',
  slug: 'server-hosting',
  description:
    'Serverbetrieb, Hosting, Container, Virtualisierung, Netzwerkdienste und selbst gehostete Infrastruktur.',
  icon: 'server',
};

const AUTOMATION_AI = {
  name: 'Automation & AI',
  slug: 'automation-ai',
  description:
    'Workflow-Automation, AI-Orchestrierung, Agents und selbst gehostete Automationsplattformen.',
  icon: 'branch',
};

const COMMUNICATION = {
  name: 'Kommunikation & Collaboration',
  slug: 'kommunikation-collaboration',
  description:
    'Kommunikationsplattformen, Collaboration, Chat, Communities, Integrationen und selbst betriebene Zusatzdienste.',
  icon: 'message-circle',
};

const articles = [
  {
    file: 'dev-container-guide.md',
    category: SERVER_HOSTING,
    title: 'Universelle Docker-Entwicklungsumgebung auf Contabo mit Dokploy',
    slug: 'docker-entwicklungsumgebung-contabo-dokploy',
    excerpt:
      'Eine wiederverwendbare Ubuntu-basierte Entwicklungsumgebung mit SSH, VS Code Remote, GitHub CLI, Node.js sowie optionalen Java-, Android- und RDP-Layern.',
    difficulty: 'Fortgeschritten',
    readingTimeMinutes: 24,
    featured: true,
    publishedAt: '2026-08-07T10:00:00+02:00',
    repositoryUrl: null,
    tags: [
      ['Docker', 'docker'],
      ['Ubuntu', 'ubuntu'],
      ['Dokploy', 'dokploy'],
      ['VS Code', 'vs-code'],
      ['SSH', 'ssh'],
      ['Node.js', 'nodejs'],
      ['Contabo', 'contabo'],
    ],
  },
  {
    file: 'ollama-dokploy-contabo.md',
    category: SERVER_HOSTING,
    title:
      'Ollama sicher mit Docker und Dokploy auf einem Contabo VPS bereitstellen',
    slug: 'ollama-docker-dokploy-contabo-intern',
    excerpt:
      'Ollama als zentralen internen LLM-Dienst auf einem Contabo-VPS deployen: Docker Compose, Dokploy, persistente Modelle und ein dediziertes Netzwerk für andere Container – ohne öffentliche API.',
    difficulty: 'Fortgeschritten',
    readingTimeMinutes: 30,
    featured: false,
    publishedAt: '2026-08-09T12:00:00+02:00',
    repositoryUrl: null,
    tags: [
      ['Ollama', 'ollama'],
      ['Docker', 'docker'],
      ['Dokploy', 'dokploy'],
      ['Contabo', 'contabo'],
      ['LLM', 'llm'],
      ['REST API', 'rest-api'],
      ['Docker Networking', 'docker-networking'],
    ],
  },
  {
    file: 'n8n-dokploy-contabo.md',
    category: AUTOMATION_AI,
    title: 'n8n mit Docker und Dokploy auf einem Contabo VPS bereitstellen',
    slug: 'n8n-docker-dokploy-contabo-ollama-llm',
    excerpt:
      'n8n mit PostgreSQL auf einem Contabo-VPS per Dokploy deployen, unter Domain/App-Pfad bereitstellen und wahlweise mit internem Ollama oder externen LLM-Providern verbinden.',
    difficulty: 'Fortgeschritten',
    readingTimeMinutes: 35,
    featured: false,
    publishedAt: '2026-08-11T08:40:00+02:00',
    repositoryUrl: null,
    tags: [
      ['n8n', 'n8n'],
      ['Docker', 'docker'],
      ['Dokploy', 'dokploy'],
      ['Contabo', 'contabo'],
      ['PostgreSQL', 'postgresql'],
      ['Automation', 'automation'],
      ['Ollama', 'ollama'],
      ['LLM', 'llm'],
      ['Traefik', 'traefik'],
      ['AI', 'ai'],
    ],
  },
  {
    file: 'n8n-praxis-ollama-workflows.md',
    package: 'n8n-praxis-workflows.zip',
    category: AUTOMATION_AI,
    title:
      'n8n praktisch nutzen: Alltagsautomationen mit Ollama im Docker-/Dokploy-Setup',
    slug: 'n8n-praxis-alltagsautomationen-ollama',
    excerpt:
      'Sechs praktische und leicht anpassbare n8n-Workflows für Notizen, E-Mails, Aufgaben, Wochenplanung und Server-Logs – mit internem Ollama auf demselben Contabo-VPS.',
    difficulty: 'Mittel',
    readingTimeMinutes: 35,
    featured: false,
    publishedAt: '2026-08-11T21:53:00+02:00',
    repositoryUrl: null,
    tags: [
      ['n8n', 'n8n'],
      ['Ollama', 'ollama'],
      ['Docker', 'docker'],
      ['Dokploy', 'dokploy'],
      ['Contabo', 'contabo'],
      ['Automation', 'automation'],
      ['Workflow', 'workflow'],
      ['LLM', 'llm'],
      ['Webhook', 'webhook'],
      ['AI', 'ai'],
    ],
  },
  {
    file: 'hermes-agent-dokploy-contabo.md',
    package: 'hermes-dokploy.zip',
    category: AUTOMATION_AI,
    title:
      'Hermes Agent mit Docker und Dokploy auf einem Contabo VPS bereitstellen',
    slug: 'hermes-agent-docker-dokploy-contabo',
    excerpt:
      'Hermes Agent von Nous Research sicher und persistent per Dokploy betreiben – mit Cloud-LLM oder dem internen Ollama-Dokploy-Paket, optionalem Dashboard, OAuth und Backup-Konzept.',
    difficulty: 'Fortgeschritten',
    readingTimeMinutes: 35,
    featured: false,
    publishedAt: '2026-08-13T00:24:00+02:00',
    repositoryUrl: 'https://github.com/NousResearch/hermes-agent',
    tags: [
      ['Hermes Agent', 'hermes-agent'],
      ['Nous Research', 'nous-research'],
      ['Docker', 'docker'],
      ['Dokploy', 'dokploy'],
      ['Contabo', 'contabo'],
      ['AI Agent', 'ai-agent'],
      ['Ollama', 'ollama'],
      ['LLM', 'llm'],
      ['Traefik', 'traefik'],
      ['Automation', 'automation'],
    ],
  },
  {
    file: 'nextcloud-dokploy-contabo.md',
    package: 'nextcloud-dokploy.zip',
    category: SERVER_HOSTING,
    title:
      'Nextcloud mit Docker und Dokploy auf einem Contabo VPS bereitstellen',
    slug: 'nextcloud-docker-dokploy-contabo',
    excerpt:
      'Nextcloud 34 mit PostgreSQL, Redis und Cron persistent auf einem Contabo VPS deployen – inklusive Dokploy-Reverse-Proxy, Unterpfad oder Subdomain, Backup und Update-Konzept.',
    difficulty: 'Fortgeschritten',
    readingTimeMinutes: 35,
    featured: false,
    publishedAt: '2026-08-13T06:21:00+02:00',
    repositoryUrl: 'https://github.com/nextcloud/docker',
    tags: [
      ['Nextcloud', 'nextcloud'],
      ['Docker', 'docker'],
      ['Dokploy', 'dokploy'],
      ['Contabo', 'contabo'],
      ['PostgreSQL', 'postgresql'],
      ['Redis', 'redis'],
      ['Traefik', 'traefik'],
      ['Cloud Storage', 'cloud-storage'],
      ['Self-Hosting', 'self-hosting'],
      ['WebDAV', 'webdav'],
    ],
  },
  {
    file: 'windows-hyperv-contabo.md',
    package: 'windows-hyperv-toolkit.zip',
    category: SERVER_HOSTING,
    title: 'Windows Hyper-V und virtuelle Maschinen auf Contabo einrichten',
    slug: 'windows-hyper-v-virtual-machines-contabo',
    excerpt:
      'Hyper-V auf Contabo richtig planen und betreiben: Produktauswahl, Windows Server, Hyper-V-Rolle, internes NAT-Netz, VM-Erstellung, Portweiterleitungen, Sicherheit und Backup.',
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
  },
  {
    file: 'discord-server-einrichten-contabo-dokploy.md',
    category: COMMUNICATION,
    title:
      'Discord-Server einrichten, absichern und mit Contabo/Dokploy integrieren',
    slug: 'discord-server-einrichten-contabo-dokploy',
    excerpt:
      'Discord praktisch einrichten: Kanäle, Rollen, Berechtigungen, Community-Sicherheit, Webhooks und optionale Bot- oder n8n-Integrationen über den bestehenden Contabo-/Dokploy-VPS.',
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
  },
  {
    file: 'hermes-discord-integration.md',
    category: AUTOMATION_AI,
    title:
      'Hermes Agent mit einem Discord-Server verbinden und in einem eigenen Kanal bereitstellen',
    slug: 'hermes-discord-integration',
    excerpt:
      'Hermes Agent über sein natives Discord Gateway mit einem dedizierten #hermes-Kanal verbinden, Zugriffe per Channel-/Rollen-Allowlist absichern und Ollama über das interne Dokploy-Netz weiterverwenden.',
    difficulty: 'Fortgeschritten',
    readingTimeMinutes: 35,
    featured: false,
    publishedAt: '2026-08-21T06:03:00+02:00',
    repositoryUrl: 'https://github.com/NousResearch/hermes-agent',
    tags: [
      ['Hermes Agent', 'hermes-agent'],
      ['Discord', 'discord'],
      ['AI Agent', 'ai-agent'],
      ['Ollama', 'ollama'],
      ['Docker', 'docker'],
      ['Dokploy', 'dokploy'],
      ['Contabo', 'contabo'],
      ['Gateway', 'gateway'],
      ['Security', 'security'],
    ],
  },
];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function preflight() {
  const missing = [];

  for (const definition of articles) {
    const articlePath = path.join(contentDir, definition.file);
    if (!(await exists(articlePath))) {
      missing.push(`Artikel: ${articlePath}`);
    }

    if (definition.package) {
      const packagePath = path.join(packageDir, definition.package);
      if (!(await exists(packagePath))) {
        missing.push(`Paket: ${packagePath}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Preflight fehlgeschlagen. Folgende Dateien fehlen:\n- ${missing.join('\n- ')}`,
    );
  }

  console.log(`Preflight OK: ${articles.length} Artikel vollständig vorhanden.`);
}

async function preparePackage(
  client,
  articleId,
  packageName,
  packageOperations,
) {
  if (!packageName) {
    return;
  }

  const source = path.join(packageDir, packageName);
  const bytes = await readFile(source);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const storageName = `${articleId}-${sha256.slice(0, 20)}.zip`;
  const target = path.join(uploadDir, storageName);

  await mkdir(uploadDir, { recursive: true });

  const previous = await client.query(
    `SELECT package_storage_name
       FROM articles
      WHERE id = $1`,
    [articleId],
  );

  const oldName = previous.rows[0]?.package_storage_name || null;
  const targetAlreadyExists = await exists(target);

  if (!targetAlreadyExists) {
    await copyFile(source, target);
  }

  const info = await stat(target);

  await client.query(
    `UPDATE articles
        SET package_original_name = $2,
            package_storage_name = $3,
            package_mime_type = 'application/zip',
            package_size_bytes = $4,
            package_sha256 = $5,
            package_uploaded_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [articleId, packageName, storageName, info.size, sha256],
  );

  packageOperations.push({
    target,
    createdTarget: !targetAlreadyExists,
    oldPath:
      oldName && oldName !== storageName
        ? path.join(uploadDir, oldName)
        : null,
  });
}

async function upsertArticle(client, definition, packageOperations) {
  const content = await readFile(
    path.join(contentDir, definition.file),
    'utf8',
  );

  const category = await client.query(
    `INSERT INTO categories (name, slug, description, icon)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       icon = EXCLUDED.icon
     RETURNING id`,
    [
      definition.category.name,
      definition.category.slug,
      definition.category.description,
      definition.category.icon,
    ],
  );

  const article = await client.query(
    `INSERT INTO articles
      (
        title,
        slug,
        excerpt,
        content_markdown,
        category_id,
        difficulty,
        reading_time_minutes,
        featured,
        published_at,
        updated_at,
        repository_url
      )
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
      definition.title,
      definition.slug,
      definition.excerpt,
      content,
      category.rows[0].id,
      definition.difficulty,
      definition.readingTimeMinutes,
      definition.featured,
      definition.publishedAt,
      definition.repositoryUrl,
    ],
  );

  const articleId = article.rows[0].id;

  await client.query(
    'DELETE FROM article_tags WHERE article_id = $1',
    [articleId],
  );

  for (const [name, slug] of definition.tags) {
    const tag = await client.query(
      `INSERT INTO tags (name, slug)
       VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name
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

  await preparePackage(
    client,
    articleId,
    definition.package,
    packageOperations,
  );

  console.log(`OK: ${article.rows[0].slug}`);
}

async function cleanupAfterRollback(packageOperations) {
  for (const operation of packageOperations.reverse()) {
    if (!operation.createdTarget) {
      continue;
    }

    try {
      await unlink(operation.target);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.warn(
          `WARN: Rollback-Datei konnte nicht gelöscht werden: ${operation.target}`,
        );
      }
    }
  }
}

async function cleanupOldPackages(packageOperations) {
  for (const operation of packageOperations) {
    if (!operation.oldPath) {
      continue;
    }

    try {
      await unlink(operation.oldPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.warn(
          `WARN: Altes Artikelpaket konnte nicht gelöscht werden: ${operation.oldPath}`,
        );
      }
    }
  }
}

async function main() {
  await preflight();
  await migrateAndSeed();

  const client = await pool.connect();
  const packageOperations = [];

  try {
    await client.query('BEGIN');

    for (const definition of articles) {
      await upsertArticle(client, definition, packageOperations);
    }

    await client.query('COMMIT');
    await cleanupOldPackages(packageOperations);

    console.log(
      `\n${articles.length} TechWissen-Artikel erfolgreich importiert/aktualisiert.`,
    );
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } finally {
      await cleanupAfterRollback(packageOperations);
    }
    throw error;
  } finally {
    client.release();
  }
}

try {
  await main();
} catch (error) {
  console.error('Sammelimport fehlgeschlagen:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
