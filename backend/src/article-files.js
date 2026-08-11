import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import multer from 'multer';

const uploadRoot = path.resolve(process.env.ARTICLE_UPLOAD_DIR || '/app/uploads/article-packages');
const temporaryDirectory = path.join(uploadRoot, '.tmp');

function megabytesFromEnvironment(name, fallback) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const packageMaxBytes = megabytesFromEnvironment('ARTICLE_PACKAGE_MAX_MB', 100) * 1024 * 1024;
const markdownMaxBytes = megabytesFromEnvironment('ARTICLE_MARKDOWN_MAX_MB', 2) * 1024 * 1024;

const requiredTemplateSections = [
  'Zielarchitektur',
  'Voraussetzungen',
  'Deployment in Dokploy',
  'Deployment prüfen',
  'Sicherheitskonzept',
  'Produktionscheckliste',
  'Quellen',
];

const recommendedTemplateSections = [
  'Repository anlegen',
  'Secrets erzeugen',
  'Docker Compose erstellen',
  'Environment-Datei',
  'Basisfunktion testen',
  'Integration mit anderen Containern',
  'Logs prüfen',
  'Healthcheck',
  'Backups',
  'Updates',
  'Empfohlene endgültige Architektur',
];

function safeOriginalName(value) {
  return path.basename(String(value || 'dokploy-package.zip')).replace(/[\r\n]/g, '').slice(0, 255) || 'dokploy-package.zip';
}

async function ensureUploadDirectories() {
  await mkdir(temporaryDirectory, { recursive: true });
}

const packageStorage = multer.diskStorage({
  destination: async (_req, _file, callback) => {
    try {
      await ensureUploadDirectories();
      callback(null, temporaryDirectory);
    } catch (error) {
      callback(error);
    }
  },
  filename: (_req, _file, callback) => callback(null, `${crypto.randomUUID()}.upload`),
});

export const packageUpload = multer({
  storage: packageStorage,
  limits: { files: 1, fileSize: packageMaxBytes },
  fileFilter: (_req, file, callback) => {
    if (path.extname(file.originalname).toLowerCase() !== '.zip') {
      return callback(new Error('Als Dokploy-Paket sind ausschließlich .zip-Dateien erlaubt.'));
    }
    callback(null, true);
  },
});

export const markdownUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: markdownMaxBytes },
  fileFilter: (_req, file, callback) => {
    if (path.extname(file.originalname).toLowerCase() !== '.md') {
      return callback(new Error('Für den Artikelimport ist ausschließlich eine .md-Datei erlaubt.'));
    }
    callback(null, true);
  },
});

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

async function assertZipSignature(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(4);
    const { bytesRead } = await handle.read(header, 0, 4, 0);
    if (bytesRead < 4) throw new Error('Das ZIP-Archiv ist leer oder unvollständig.');
    const signature = header.toString('hex');
    const allowed = new Set(['504b0304', '504b0506', '504b0708']);
    if (!allowed.has(signature)) throw new Error('Die hochgeladene Datei besitzt keine gültige ZIP-Signatur.');
  } finally {
    await handle.close();
  }
}

export async function finalizePackageUpload(file) {
  if (!file?.path) throw new Error('Es wurde kein Dokploy-Paket hochgeladen.');
  await assertZipSignature(file.path);

  const storageName = `${crypto.randomUUID()}.zip`;
  const destination = path.join(uploadRoot, storageName);
  const sha256 = await sha256File(file.path);
  await rename(file.path, destination);

  return {
    originalName: safeOriginalName(file.originalname),
    storageName,
    mimeType: 'application/zip',
    sizeBytes: Number(file.size || 0),
    sha256,
    absolutePath: destination,
  };
}

export async function discardTemporaryUpload(file) {
  if (!file?.path) return;
  await unlink(file.path).catch(() => {});
}

export function storedPackagePath(storageName) {
  const safeName = path.basename(String(storageName || ''));
  if (!safeName || safeName !== storageName || !safeName.endsWith('.zip')) {
    throw new Error('Ungültiger interner Paketname.');
  }
  return path.join(uploadRoot, safeName);
}

export async function deleteStoredPackage(storageName) {
  if (!storageName) return;
  await unlink(storedPackagePath(storageName)).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
}

function normalizeHeading(value) {
  return String(value || '')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('de-DE');
}

function extractFirstParagraph(markdown, h1LineIndex) {
  const lines = markdown.split(/\r?\n/);
  const collected = [];
  for (let index = h1LineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      if (collected.length) break;
      continue;
    }
    if (/^#{1,6}\s/.test(line) || /^```/.test(line) || /^>/.test(line) || /^[-*+]\s/.test(line)) {
      if (collected.length) break;
      continue;
    }
    collected.push(line);
  }
  return collected.join(' ').replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/[`*_]/g, '').trim().slice(0, 600);
}

function estimateReadingTime(markdown) {
  const words = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`\[\](){}|~-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

export function validateArticleMarkdown(file) {
  if (!file?.buffer) throw new Error('Es wurde keine Markdown-Datei hochgeladen.');

  let markdown;
  try {
    markdown = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer).replace(/^\uFEFF/, '');
  } catch {
    throw new Error('Die Markdown-Datei muss gültig UTF-8-kodiert sein.');
  }

  const errors = [];
  const warnings = [];
  const lines = markdown.split(/\r?\n/);
  const nonEmptyIndex = lines.findIndex((line) => line.trim());
  const firstLine = nonEmptyIndex >= 0 ? lines[nonEmptyIndex].trim() : '';
  const h1Matches = lines.filter((line) => /^#\s+\S/.test(line.trim()));
  const title = firstLine.match(/^#\s+(.+)$/)?.[1]?.trim() || '';

  if (!markdown.trim()) errors.push('Die Markdown-Datei ist leer.');
  if (!title) errors.push('Die erste inhaltliche Zeile muss ein H1-Titel im Format „# Titel“ sein.');
  if (h1Matches.length !== 1) errors.push('Die TechWissen-Vorlage erwartet genau eine H1-Überschrift.');
  if (/\{\{[^}]+\}\}/.test(markdown)) errors.push('Die Datei enthält noch nicht ersetzte Template-Platzhalter im Format {{...}}.');

  const sectionNames = lines
    .filter((line) => /^##\s+/.test(line.trim()))
    .map((line) => normalizeHeading(line.trim().replace(/^##\s+/, '')));

  for (const section of requiredTemplateSections) {
    if (!sectionNames.includes(normalizeHeading(section))) errors.push(`Pflichtabschnitt fehlt: „## ${section}“.`);
  }

  for (const section of recommendedTemplateSections) {
    if (!sectionNames.includes(normalizeHeading(section))) warnings.push(`Empfohlener Abschnitt fehlt: „## ${section}“.`);
  }

  const fenceCount = (markdown.match(/^```/gm) || []).length;
  if (fenceCount % 2 !== 0) errors.push('Mindestens ein Markdown-Codeblock mit ``` ist nicht geschlossen.');
  if (markdown.length < 500) warnings.push('Der Artikel ist für eine technische TechWissen-Anleitung ungewöhnlich kurz.');

  const excerpt = extractFirstParagraph(markdown, Math.max(0, nonEmptyIndex));
  if (!excerpt || excerpt.length < 10) warnings.push('Aus der Einleitung konnte keine geeignete Kurzbeschreibung abgeleitet werden.');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    template: 'TechWissen-Anleitungsstruktur',
    file: {
      name: safeOriginalName(file.originalname),
      sizeBytes: file.size,
    },
    article: {
      title,
      excerpt,
      content_markdown: markdown.trim(),
      reading_time_minutes: estimateReadingTime(markdown),
    },
  };
}
