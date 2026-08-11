import { appUrl } from '../config.js';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  adminLogin,
  createAdminArticle,
  createAdminCategory,
  deleteAdminArticle,
  deleteAdminArticlePackage,
  deleteAdminCategory,
  getAdminArticle,
  getAdminArticles,
  getAdminCategories,
  getAdminSession,
  importAdminArticleMarkdown,
  updateAdminArticle,
  updateAdminCategory,
  uploadAdminArticlePackage,
} from '../api.js';
import CodeBlock from '../components/CodeBlock.jsx';
import Loading from '../components/Loading.jsx';

const emptyCategory = { name: '', slug: '', description: '', icon: 'code' };
const emptyArticle = {
  title: '',
  slug: '',
  excerpt: '',
  repository_url: '',
  content_markdown: '# Neuer Artikel\n\nArtikelinhalt ...',
  category_id: '',
  difficulty: 'Einsteiger',
  reading_time_minutes: 5,
  featured: false,
  published_at: toDateTimeLocal(new Date()),
  tagsText: '',
};

function toDateTimeLocal(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function markdownComponents() {
  return {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const value = String(children).replace(/\n$/, '');
      const inline = !className && !value.includes('\n');
      if (inline) return <code className="inline-code" {...props}>{children}</code>;
      return <CodeBlock language={match?.[1] || 'text'} value={value} />;
    },
  };
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await adminLogin(username, password);
      sessionStorage.setItem('techwissen-admin-token', result.token);
      onLogin(result.token, result.username);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <a href={appUrl("/")} className="admin-back-link">← Zur Wissensbasis</a>
        <span className="section-kicker">TECHWISSEN ADMIN</span>
        <h1>Redaktion anmelden</h1>
        <p>Artikel und Kategorien verwalten. Die Anmeldung wird serverseitig geprüft.</p>
        <form onSubmit={submit} className="admin-form-stack">
          <label>
            <span>Benutzername</span>
            <input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label>
            <span>Passwort</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="admin-alert error">{error}</div>}
          <button className="button-primary admin-primary" disabled={busy}>{busy ? 'Anmeldung …' : 'Anmelden'}</button>
        </form>
      </section>
    </main>
  );
}

function CategoriesAdmin({ token, onChanged }) {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyCategory);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setCategories(await getAdminCategories(token));
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, [token]);

  function edit(category) {
    setEditingId(category.id);
    setForm({ name: category.name, slug: category.slug, description: category.description || '', icon: category.icon || 'code' });
    setMessage('');
    setError('');
  }

  function reset() {
    setEditingId(null);
    setForm(emptyCategory);
    setMessage('');
    setError('');
  }

  async function save(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      if (editingId) await updateAdminCategory(token, editingId, form);
      else await createAdminCategory(token, form);
      await load();
      onChanged();
      setMessage(editingId ? 'Kategorie aktualisiert.' : 'Kategorie angelegt.');
      setEditingId(null);
      setForm(emptyCategory);
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(category) {
    if (!window.confirm(`Kategorie „${category.name}“ wirklich löschen?`)) return;
    setError('');
    setMessage('');
    try {
      await deleteAdminCategory(token, category.id);
      await load();
      onChanged();
      if (editingId === category.id) reset();
      setMessage('Kategorie gelöscht.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-two-column">
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><span className="section-kicker">KATEGORIEN</span><h2>{editingId ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h2></div>
          {editingId && <button className="admin-link-button" onClick={reset}>Abbrechen</button>}
        </div>
        <form onSubmit={save} className="admin-form-stack">
          <label><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label><span>Slug <small>leer = automatisch</small></span><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="server-hosting" /></label>
          <label><span>Beschreibung</span><textarea rows="4" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label><span>Icon-Key</span><input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="server" /></label>
          {message && <div className="admin-alert success">{message}</div>}
          {error && <div className="admin-alert error">{error}</div>}
          <button className="button-primary admin-primary">{editingId ? 'Änderungen speichern' : 'Kategorie anlegen'}</button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="section-kicker">BESTAND</span><h2>Vorhandene Kategorien</h2></div></div>
        <div className="admin-list">
          {categories.map((category) => (
            <article key={category.id} className="admin-list-row">
              <div>
                <strong>{category.name}</strong>
                <small>/{category.slug} · {category.article_count} Artikel</small>
                {category.description && <p>{category.description}</p>}
              </div>
              <div className="admin-row-actions">
                <button onClick={() => edit(category)}>Bearbeiten</button>
                <button className="danger" onClick={() => remove(category)} disabled={category.article_count > 0}>Löschen</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** exponent)).toLocaleString('de-DE', { maximumFractionDigits: exponent ? 1 : 0 })} ${units[exponent]}`;
}

function packageFromArticle(article) {
  if (!article?.package_original_name) return null;
  return {
    original_name: article.package_original_name,
    size_bytes: article.package_size_bytes,
    sha256: article.package_sha256,
    uploaded_at: article.package_uploaded_at,
  };
}

function ArticlesAdmin({ token, categories }) {
  const [articles, setArticles] = useState([]);
  const [form, setForm] = useState(emptyArticle);
  const [editingId, setEditingId] = useState(null);
  const [mode, setMode] = useState('list');
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [markdownValidation, setMarkdownValidation] = useState(null);
  const [markdownBusy, setMarkdownBusy] = useState(false);
  const [packageFile, setPackageFile] = useState(null);
  const [existingPackage, setExistingPackage] = useState(null);

  async function loadList() {
    setArticles(await getAdminArticles(token));
  }

  useEffect(() => { loadList().catch((err) => setError(err.message)); }, [token]);

  function resetUploadState() {
    setMarkdownValidation(null);
    setPackageFile(null);
    setExistingPackage(null);
  }

  function newArticle() {
    setEditingId(null);
    setForm({ ...emptyArticle, category_id: categories[0]?.id || '', published_at: toDateTimeLocal(new Date()) });
    setMode('editor');
    setPreview(false);
    setMessage('');
    setError('');
    resetUploadState();
  }

  async function editArticle(id) {
    setLoading(true);
    setError('');
    setMessage('');
    setMarkdownValidation(null);
    setPackageFile(null);
    try {
      const article = await getAdminArticle(token, id);
      setEditingId(article.id);
      setExistingPackage(packageFromArticle(article));
      setForm({
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        repository_url: article.repository_url || '',
        content_markdown: article.content_markdown,
        category_id: article.category_id,
        difficulty: article.difficulty,
        reading_time_minutes: article.reading_time_minutes,
        featured: article.featured,
        published_at: toDateTimeLocal(article.published_at),
        tagsText: (article.tags || []).map((tag) => tag.name).join(', '),
      });
      setMode('editor');
      setPreview(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function importMarkdown(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setMarkdownBusy(true);
    setError('');
    setMessage('');
    try {
      const validation = await importAdminArticleMarkdown(token, file);
      setMarkdownValidation(validation);
      if (!validation.valid) {
        setError('Die Markdown-Datei entspricht noch nicht den Pflichtvorgaben der TechWissen-Artikelvorlage.');
        return;
      }

      setForm((current) => ({
        ...current,
        title: validation.article.title || current.title,
        excerpt: validation.article.excerpt || current.excerpt,
        content_markdown: validation.article.content_markdown,
        reading_time_minutes: validation.article.reading_time_minutes || current.reading_time_minutes,
      }));
      setMessage('Markdown-Datei validiert und in den neuen Artikel übernommen. Metadaten können vor dem Speichern angepasst werden.');
    } catch (err) {
      setMarkdownValidation(null);
      setError(err.message);
    } finally {
      setMarkdownBusy(false);
    }
  }

  function selectPackage(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    setError('');
    if (file && !file.name.toLowerCase().endsWith('.zip')) {
      setPackageFile(null);
      setError('Als Dokploy-Paket kann nur ein ZIP-Archiv ausgewählt werden.');
      return;
    }
    setPackageFile(file);
  }

  async function removeExistingPackage() {
    if (!editingId || !existingPackage) return;
    if (!window.confirm(`Dokploy-Paket „${existingPackage.original_name}“ wirklich entfernen?`)) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await deleteAdminArticlePackage(token, editingId);
      setExistingPackage(null);
      await loadList();
      setMessage('Dokploy-Paket entfernt.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    const payload = {
      ...form,
      category_id: Number(form.category_id),
      reading_time_minutes: Number(form.reading_time_minutes),
      published_at: new Date(form.published_at).toISOString(),
      tags: form.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
    };

    let saved;
    const wasEditing = Boolean(editingId);
    try {
      saved = wasEditing
        ? await updateAdminArticle(token, editingId, payload)
        : await createAdminArticle(token, payload);
      const savedId = saved.id;

      if (packageFile) {
        try {
          const uploaded = await uploadAdminArticlePackage(token, savedId, packageFile);
          setExistingPackage(uploaded);
          setPackageFile(null);
        } catch (packageError) {
          setEditingId(savedId);
          await loadList();
          setMessage('Artikel wurde gespeichert.');
          setError(`Das Dokploy-Paket konnte nicht hochgeladen werden: ${packageError.message}`);
          return;
        }
      }

      await loadList();
      setMessage(wasEditing ? 'Artikel aktualisiert.' : 'Artikel angelegt.');
      setMode('list');
      resetUploadState();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove(article) {
    if (!window.confirm(`Artikel „${article.title}“ wirklich löschen?`)) return;
    setError('');
    try {
      await deleteAdminArticle(token, article.id);
      await loadList();
      setMessage('Artikel gelöscht.');
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading && mode === 'list') return <Loading />;

  if (mode === 'editor') {
    return (
      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-heading">
          <div><span className="section-kicker">ARTIKEL</span><h2>{editingId ? 'Artikel bearbeiten' : 'Neuen Artikel anlegen'}</h2></div>
          <div className="admin-heading-actions">
            <button className="admin-link-button" type="button" onClick={() => setPreview(!preview)}>{preview ? 'Editor' : 'Vorschau'}</button>
            <button className="admin-link-button" type="button" onClick={() => setMode('list')}>Zur Liste</button>
          </div>
        </div>

        <form onSubmit={save} className="admin-article-form">
          {!editingId && (
            <section className="admin-upload-card admin-markdown-import">
              <div>
                <span className="section-kicker">NEUER ARTIKEL</span>
                <h3>TechWissen-Markdown importieren</h3>
                <p>Eine <code>.md</code>-Datei aus der TechWissen-Artikelvorlage hochladen. Der Server prüft Struktur und Pflichtabschnitte, bevor der Inhalt in den Editor übernommen wird.</p>
              </div>
              <label className="admin-file-button">
                <span>{markdownBusy ? 'Validierung …' : '.MD auswählen'}</span>
                <input type="file" accept=".md,text/markdown,text/plain" disabled={markdownBusy || loading} onChange={importMarkdown} />
              </label>
              {markdownValidation && (
                <div className={`admin-validation ${markdownValidation.valid ? 'valid' : 'invalid'}`}>
                  <strong>{markdownValidation.valid ? 'Vorlage gültig' : 'Validierung fehlgeschlagen'}</strong>
                  <small>{markdownValidation.file.name} · {formatBytes(markdownValidation.file.sizeBytes)}</small>
                  {markdownValidation.errors?.length > 0 && <ul>{markdownValidation.errors.map((item) => <li key={item}>{item}</li>)}</ul>}
                  {markdownValidation.warnings?.length > 0 && <details><summary>{markdownValidation.warnings.length} Hinweis(e)</summary><ul>{markdownValidation.warnings.map((item) => <li key={item}>{item}</li>)}</ul></details>}
                </div>
              )}
            </section>
          )}

          <div className="admin-fields-grid">
            <label className="wide"><span>Titel</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
            <label><span>Slug <small>leer = automatisch</small></span><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label>
            <label><span>Kategorie</span><select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required><option value="">Bitte wählen</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="wide"><span>Kurzbeschreibung</span><textarea rows="3" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} required /></label>
            <label className="wide"><span>Repository-URL <small>optional, z. B. GitHub/GitLab</small></span><input type="url" value={form.repository_url} onChange={(e) => setForm({ ...form, repository_url: e.target.value })} placeholder="https://github.com/organisation/repository" /></label>
            <label><span>Schwierigkeitsgrad</span><select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}><option>Einsteiger</option><option>Fortgeschritten</option><option>Experte</option></select></label>
            <label><span>Lesezeit (Minuten)</span><input type="number" min="1" max="999" value={form.reading_time_minutes} onChange={(e) => setForm({ ...form, reading_time_minutes: e.target.value })} /></label>
            <label><span>Veröffentlichung</span><input type="datetime-local" required value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} /></label>
            <label><span>Tags <small>kommagetrennt</small></span><input value={form.tagsText} onChange={(e) => setForm({ ...form, tagsText: e.target.value })} placeholder="Docker, Ubuntu, SSH" /></label>
            <label className="admin-checkbox"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /><span>Als Featured-Artikel hervorheben</span></label>
          </div>

          <section className="admin-upload-card admin-package-upload">
            <div>
              <span className="section-kicker">DOWNLOAD</span>
              <h3>Dokploy-Paket hinterlegen</h3>
              <p>Optional ein ZIP-Archiv zum Artikel bereitstellen. Die Datei wird beim Speichern hochgeladen und anschließend auf der öffentlichen Artikelseite als Download angeboten.</p>
            </div>
            {existingPackage && (
              <div className="admin-existing-package">
                <div><strong>{existingPackage.original_name}</strong><small>{formatBytes(existingPackage.size_bytes)}{existingPackage.sha256 ? ` · SHA-256 ${existingPackage.sha256.slice(0, 16)}…` : ''}</small></div>
                <button type="button" className="danger admin-package-remove" onClick={removeExistingPackage} disabled={loading}>Entfernen</button>
              </div>
            )}
            <div className="admin-package-picker">
              <label className="admin-file-button">
                <span>{existingPackage ? 'ZIP ersetzen' : 'ZIP auswählen'}</span>
                <input type="file" accept=".zip,application/zip" disabled={loading} onChange={selectPackage} />
              </label>
              {packageFile && <span className="admin-selected-file">Ausgewählt: <strong>{packageFile.name}</strong> · {formatBytes(packageFile.size)}</span>}
            </div>
          </section>

          <div className="admin-content-editor">
            <div className="admin-editor-label"><strong>{preview ? 'Markdown-Vorschau' : 'Markdown-Inhalt'}</strong><small>{form.content_markdown.length.toLocaleString('de-DE')} Zeichen</small></div>
            {preview ? (
              <div className="markdown-body admin-markdown-preview">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents()}>{form.content_markdown}</ReactMarkdown>
              </div>
            ) : (
              <textarea className="admin-markdown-input" value={form.content_markdown} onChange={(e) => setForm({ ...form, content_markdown: e.target.value })} spellCheck="false" required />
            )}
          </div>

          {message && <div className="admin-alert success">{message}</div>}
          {error && <div className="admin-alert error">{error}</div>}
          <div className="admin-form-actions">
            <button type="button" className="admin-secondary" onClick={() => setMode('list')}>Abbrechen</button>
            <button className="button-primary admin-primary" disabled={loading}>{loading ? 'Speichern …' : 'Artikel speichern'}</button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div><span className="section-kicker">ARTIKEL</span><h2>Artikel verwalten</h2></div>
        <button className="button-primary admin-primary" onClick={newArticle}>+ Neuer Artikel</button>
      </div>
      {message && <div className="admin-alert success">{message}</div>}
      {error && <div className="admin-alert error">{error}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Artikel</th><th>Kategorie</th><th>Ressourcen</th><th>Stand</th><th /></tr></thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id}>
                <td><strong>{article.title}</strong><small>/{article.slug}</small>{article.featured && <span className="admin-featured">Featured</span>}</td>
                <td>{article.category_name}</td>
                <td><div className="admin-resource-badges">{article.repository_url && <span>Repository</span>}{article.has_package && <span>ZIP</span>}{!article.repository_url && !article.has_package && <small>—</small>}</div></td>
                <td>{new Date(article.updated_at).toLocaleDateString('de-DE')}</td>
                <td><div className="admin-row-actions"><button onClick={() => editArticle(article.id)}>Bearbeiten</button><a href={appUrl(`/artikel/${article.slug}`)} target="_blank" rel="noreferrer">Ansehen</a><button className="danger" onClick={() => remove(article)}>Löschen</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem('techwissen-admin-token') || '');
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(Boolean(token));
  const [tab, setTab] = useState('articles');
  const [categories, setCategories] = useState([]);
  const [categoryRevision, setCategoryRevision] = useState(0);

  useEffect(() => {
    if (!token) return;
    getAdminSession(token)
      .then((session) => setUsername(session.username))
      .catch(() => {
        sessionStorage.removeItem('techwissen-admin-token');
        setToken('');
      })
      .finally(() => setChecking(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getAdminCategories(token).then(setCategories).catch(() => {});
  }, [token, categoryRevision]);

  const stats = useMemo(() => ({ categories: categories.length }), [categories]);

  function loggedIn(nextToken, nextUsername) {
    setToken(nextToken);
    setUsername(nextUsername);
    setChecking(false);
  }

  function logout() {
    sessionStorage.removeItem('techwissen-admin-token');
    setToken('');
    setUsername('');
  }

  if (!token) return <Login onLogin={loggedIn} />;
  if (checking) return <main className="admin-loading"><Loading /></main>;

  return (
    <main className="admin-page">
      <div className="container admin-shell">
        <header className="admin-topbar">
          <div>
            <a className="admin-back-link" href={appUrl("/")}>← TechWissen öffnen</a>
            <h1>Redaktion</h1>
            <p>Artikel und Kategorien der Wissensbasis verwalten.</p>
          </div>
          <div className="admin-user"><span>{username}</span><button onClick={logout}>Abmelden</button></div>
        </header>

        <div className="admin-summary">
          <div><span>Bereich</span><strong>{tab === 'articles' ? 'Artikel' : 'Kategorien'}</strong></div>
          <div><span>Kategorien</span><strong>{stats.categories}</strong></div>
          <div><span>Sitzung</span><strong>geschützt</strong></div>
        </div>

        <nav className="admin-tabs" aria-label="Adminbereiche">
          <button className={tab === 'articles' ? 'active' : ''} onClick={() => setTab('articles')}>Artikel</button>
          <button className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>Kategorien</button>
        </nav>

        {tab === 'articles' ? (
          <ArticlesAdmin token={token} categories={categories} />
        ) : (
          <CategoriesAdmin token={token} onChanged={() => setCategoryRevision((value) => value + 1)} />
        )}
      </div>
    </main>
  );
}
