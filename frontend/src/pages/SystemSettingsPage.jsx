import { useEffect, useMemo, useState } from 'react';
import { appUrl } from '../config.js';
import {
  createAdminArticle,
  getAdminArticles,
  getAdminCategories,
  getAdminSession,
  importAdminArticleMarkdown,
  updateAdminArticle,
} from '../api.js';
import Loading from '../components/Loading.jsx';
import articleTemplate from '../templates/techwissen-artikel-template.md?raw';

function toDateTimeLocal(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

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

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** exponent)).toLocaleString('de-DE', { maximumFractionDigits: exponent ? 1 : 0 })} ${units[exponent]}`;
}

const emptyImportForm = {
  slug: '',
  excerpt: '',
  category_id: '',
  difficulty: 'Einsteiger',
  reading_time_minutes: 5,
  repository_url: '',
  tagsText: '',
  featured: false,
  published_at: toDateTimeLocal(new Date()),
};

export default function SystemSettingsPage() {
  const [token] = useState(() => sessionStorage.getItem('techwissen-admin-token') || '');
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(Boolean(token));
  const [categories, setCategories] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [validation, setValidation] = useState(null);
  const [form, setForm] = useState(emptyImportForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }

    Promise.all([getAdminSession(token), getAdminCategories(token)])
      .then(([session, categoryRows]) => {
        setUsername(session.username);
        setCategories(categoryRows);
        setForm((current) => ({
          ...current,
          category_id: current.category_id || String(categoryRows[0]?.id || ''),
        }));
      })
      .catch(() => {
        sessionStorage.removeItem('techwissen-admin-token');
        setError('Die Admin-Sitzung ist abgelaufen. Bitte erneut anmelden.');
      })
      .finally(() => setChecking(false));
  }, [token]);

  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  function downloadTemplate() {
    const blob = new Blob([articleTemplate], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'techwissen-artikel-template.md';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function selectMarkdown(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;

    setSelectedFile(file);
    setValidation(null);
    setMessage('');
    setError('');
    setResult(null);
    setBusy(true);

    try {
      const nextValidation = await importAdminArticleMarkdown(token, file);
      setValidation(nextValidation);

      if (!nextValidation.valid) {
        setError('Die Datei kann noch nicht importiert werden. Behebe zuerst die gemeldeten Strukturfehler.');
        return;
      }

      setForm((current) => ({
        ...current,
        slug: slugify(nextValidation.article.title),
        excerpt: nextValidation.article.excerpt || current.excerpt,
        reading_time_minutes: nextValidation.article.reading_time_minutes || current.reading_time_minutes,
        published_at: toDateTimeLocal(new Date()),
      }));
      setMessage('Die Markdown-Datei ist valide. Prüfe jetzt die Metadaten und starte anschließend den Import.');
    } catch (err) {
      setSelectedFile(null);
      setValidation(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function importArticle(event) {
    event.preventDefault();
    if (!validation?.valid) {
      setError('Vor dem Import muss eine gültige Markdown-Datei ausgewählt werden.');
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');
    setResult(null);

    try {
      const slug = slugify(form.slug || validation.article.title);
      if (!slug) throw new Error('Es konnte kein gültiger Artikel-Slug erzeugt werden.');

      const payload = {
        title: validation.article.title,
        slug,
        excerpt: form.excerpt || validation.article.excerpt,
        repository_url: form.repository_url,
        content_markdown: validation.article.content_markdown,
        category_id: Number(form.category_id),
        difficulty: form.difficulty,
        reading_time_minutes: Number(form.reading_time_minutes),
        featured: form.featured,
        published_at: new Date(form.published_at).toISOString(),
        tags: form.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
      };

      if (!payload.category_id) throw new Error('Bitte eine Kategorie auswählen.');
      if (!payload.excerpt || payload.excerpt.trim().length < 10) {
        throw new Error('Die Kurzbeschreibung muss mindestens 10 Zeichen enthalten.');
      }

      const existingArticles = await getAdminArticles(token);
      const existing = existingArticles.find((article) => article.slug === slug);
      const saved = existing
        ? await updateAdminArticle(token, existing.id, payload)
        : await createAdminArticle(token, payload);

      const action = existing ? 'aktualisiert' : 'angelegt';
      setResult({ action, slug: saved.slug || slug, id: saved.id || existing?.id });
      setMessage(`Artikel „${validation.article.title}“ wurde erfolgreich ${action}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <main className="admin-loading"><Loading /></main>;

  if (!token || !username) {
    return (
      <main className="admin-login-page">
        <section className="admin-login-card">
          <a href={appUrl('/admin')} className="admin-back-link">← Zur Admin-Anmeldung</a>
          <span className="section-kicker">SYSTEMEINSTELLUNGEN</span>
          <h1>Admin-Anmeldung erforderlich</h1>
          <p>Der Artikelimport ist ausschließlich innerhalb einer gültigen Admin-Sitzung verfügbar.</p>
          {error && <div className="admin-alert error">{error}</div>}
          <a className="button-primary admin-primary" href={appUrl('/admin')}>Admin öffnen</a>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="container admin-shell">
        <header className="admin-topbar">
          <div>
            <a className="admin-back-link" href={appUrl('/admin')}>← Redaktion</a>
            <h1>Systemeinstellungen</h1>
            <p>Systemweite Werkzeuge und Importfunktionen für TechWissen.</p>
          </div>
          <div className="admin-user"><span>{username}</span></div>
        </header>

        <div className="admin-summary">
          <div><span>Rubrik</span><strong>Artikelimport</strong></div>
          <div><span>Validierung</span><strong>serverseitig</strong></div>
          <div><span>Importmodus</span><strong>idempotent per Slug</strong></div>
        </div>

        <section className="admin-two-column">
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="section-kicker">ARTIKELIMPORT</span>
                <h2>TechWissen-Template</h2>
              </div>
            </div>
            <div className="admin-form-stack">
              <p>Das Template enthält alle Pflichtabschnitte der TechWissen-Anleitungsstruktur und alle aktuell empfohlenen Ergänzungen. Die Datei kann lokal bearbeitet und anschließend hier wieder importiert werden.</p>
              <button type="button" className="button-primary admin-primary" onClick={downloadTemplate}>Template herunterladen</button>
              <div className="admin-validation valid">
                <strong>Workflow</strong>
                <ol>
                  <li>Template herunterladen und Inhalt anpassen.</li>
                  <li><code>.md</code>-Datei auswählen.</li>
                  <li>Serverseitige Strukturprüfung abwarten.</li>
                  <li>Kategorie und Metadaten kontrollieren.</li>
                  <li>Mit „Artikel importieren“ in die Datenbank übernehmen.</li>
                </ol>
                <small>Existiert der Slug bereits, wird der bestehende Artikel aktualisiert. Andernfalls wird ein neuer Artikel angelegt.</small>
              </div>
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="section-kicker">IMPORT</span>
                <h2>Artikel importieren</h2>
              </div>
            </div>

            <form className="admin-form-stack" onSubmit={importArticle}>
              <label className="admin-file-button">
                <span>{busy && !validation ? 'Validierung …' : '.MD auswählen'}</span>
                <input type="file" accept=".md,text/markdown,text/plain" disabled={busy} onChange={selectMarkdown} />
              </label>

              {selectedFile && (
                <div className="admin-selected-file">Ausgewählt: <strong>{selectedFile.name}</strong> · {formatBytes(selectedFile.size)}</div>
              )}

              {validation && (
                <div className={`admin-validation ${validation.valid ? 'valid' : 'invalid'}`}>
                  <strong>{validation.valid ? 'Vorlage gültig' : 'Validierung fehlgeschlagen'}</strong>
                  <small>{validation.file.name} · {formatBytes(validation.file.sizeBytes)} · {validation.article.reading_time_minutes} Min. Lesezeit</small>
                  {validation.errors?.length > 0 && <ul>{validation.errors.map((item) => <li key={item}>{item}</li>)}</ul>}
                  {validation.warnings?.length > 0 && <details><summary>{validation.warnings.length} Hinweis(e)</summary><ul>{validation.warnings.map((item) => <li key={item}>{item}</li>)}</ul></details>}
                </div>
              )}

              {validation?.valid && (
                <>
                  <label>
                    <span>Titel</span>
                    <input value={validation.article.title} readOnly />
                  </label>
                  <label>
                    <span>Slug</span>
                    <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
                  </label>
                  <label>
                    <span>Kategorie</span>
                    <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required>
                      <option value="">Bitte wählen</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Kurzbeschreibung</span>
                    <textarea rows="4" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} required />
                  </label>
                  <label>
                    <span>Schwierigkeitsgrad</span>
                    <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                      <option>Einsteiger</option>
                      <option>Fortgeschritten</option>
                      <option>Experte</option>
                    </select>
                  </label>
                  <label>
                    <span>Lesezeit (Minuten)</span>
                    <input type="number" min="1" max="999" value={form.reading_time_minutes} onChange={(e) => setForm({ ...form, reading_time_minutes: e.target.value })} />
                  </label>
                  <label>
                    <span>Tags <small>kommagetrennt</small></span>
                    <input value={form.tagsText} onChange={(e) => setForm({ ...form, tagsText: e.target.value })} placeholder="Docker, Dokploy, Ubuntu" />
                  </label>
                  <label>
                    <span>Repository-URL <small>optional</small></span>
                    <input type="url" value={form.repository_url} onChange={(e) => setForm({ ...form, repository_url: e.target.value })} placeholder="https://github.com/organisation/repository" />
                  </label>
                  <label>
                    <span>Veröffentlichung</span>
                    <input type="datetime-local" required value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} />
                  </label>
                  <label className="admin-checkbox">
                    <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
                    <span>Als Featured-Artikel hervorheben</span>
                  </label>

                  {selectedCategory && <small>Zielkategorie: <strong>{selectedCategory.name}</strong> /{selectedCategory.slug}</small>}
                </>
              )}

              {message && <div className="admin-alert success">{message}</div>}
              {error && <div className="admin-alert error">{error}</div>}
              {result && (
                <div className="admin-alert success">
                  Datenbank-ID: {result.id || 'vorhanden'} · Status: {result.action}.{' '}
                  <a href={appUrl(`/artikel/${result.slug}`)} target="_blank" rel="noreferrer">Artikel öffnen</a>
                </div>
              )}

              <button className="button-primary admin-primary" disabled={busy || !validation?.valid || !categories.length}>
                {busy ? 'Import läuft …' : 'Artikel importieren'}
              </button>
              {!categories.length && <div className="admin-alert error">Für den Import muss zuerst mindestens eine Kategorie im Redaktionsbereich vorhanden sein.</div>}
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
