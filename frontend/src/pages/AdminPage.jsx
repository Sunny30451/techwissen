import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  adminLogin,
  createAdminArticle,
  createAdminCategory,
  deleteAdminArticle,
  deleteAdminCategory,
  getAdminArticle,
  getAdminArticles,
  getAdminCategories,
  getAdminSession,
  updateAdminArticle,
  updateAdminCategory,
} from '../api.js';
import CodeBlock from '../components/CodeBlock.jsx';
import Loading from '../components/Loading.jsx';

const emptyCategory = { name: '', slug: '', description: '', icon: 'code' };
const emptyArticle = {
  title: '',
  slug: '',
  excerpt: '',
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
        <a href="/" className="admin-back-link">← Zur Wissensbasis</a>
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

function ArticlesAdmin({ token, categories }) {
  const [articles, setArticles] = useState([]);
  const [form, setForm] = useState(emptyArticle);
  const [editingId, setEditingId] = useState(null);
  const [mode, setMode] = useState('list');
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadList() {
    setArticles(await getAdminArticles(token));
  }

  useEffect(() => { loadList().catch((err) => setError(err.message)); }, [token]);

  function newArticle() {
    setEditingId(null);
    setForm({ ...emptyArticle, category_id: categories[0]?.id || '' });
    setMode('editor');
    setPreview(false);
    setMessage('');
    setError('');
  }

  async function editArticle(id) {
    setLoading(true);
    setError('');
    try {
      const article = await getAdminArticle(token, id);
      setEditingId(article.id);
      setForm({
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
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

    try {
      if (editingId) await updateAdminArticle(token, editingId, payload);
      else await createAdminArticle(token, payload);
      await loadList();
      setMessage(editingId ? 'Artikel aktualisiert.' : 'Artikel angelegt.');
      setMode('list');
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
          <div className="admin-fields-grid">
            <label className="wide"><span>Titel</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
            <label><span>Slug <small>leer = automatisch</small></span><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label>
            <label><span>Kategorie</span><select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required><option value="">Bitte wählen</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="wide"><span>Kurzbeschreibung</span><textarea rows="3" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} required /></label>
            <label><span>Schwierigkeitsgrad</span><select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}><option>Einsteiger</option><option>Fortgeschritten</option><option>Experte</option></select></label>
            <label><span>Lesezeit (Minuten)</span><input type="number" min="1" max="999" value={form.reading_time_minutes} onChange={(e) => setForm({ ...form, reading_time_minutes: e.target.value })} /></label>
            <label><span>Veröffentlichung</span><input type="datetime-local" required value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} /></label>
            <label><span>Tags <small>kommagetrennt</small></span><input value={form.tagsText} onChange={(e) => setForm({ ...form, tagsText: e.target.value })} placeholder="Docker, Ubuntu, SSH" /></label>
            <label className="admin-checkbox"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /><span>Als Featured-Artikel hervorheben</span></label>
          </div>

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
          <thead><tr><th>Artikel</th><th>Kategorie</th><th>Stand</th><th /></tr></thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id}>
                <td><strong>{article.title}</strong><small>/{article.slug}</small>{article.featured && <span className="admin-featured">Featured</span>}</td>
                <td>{article.category_name}</td>
                <td>{new Date(article.updated_at).toLocaleDateString('de-DE')}</td>
                <td><div className="admin-row-actions"><button onClick={() => editArticle(article.id)}>Bearbeiten</button><a href={`/artikel/${article.slug}`} target="_blank" rel="noreferrer">Ansehen</a><button className="danger" onClick={() => remove(article)}>Löschen</button></div></td>
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
            <a className="admin-back-link" href="/">← TechWissen öffnen</a>
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
