import { appUrl } from '../config.js';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getArticle } from '../api.js';
import CodeBlock from '../components/CodeBlock.jsx';
import Icon from '../components/Icon.jsx';
import Loading from '../components/Loading.jsx';

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[ä]/g, 'ae')
    .replace(/[ö]/g, 'oe')
    .replace(/[ü]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function nodeText(children) {
  return Array.isArray(children) ? children.map(nodeText).join('') : String(children ?? '');
}

function formatDate(value) {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}

export default function ArticlePage({ slug }) {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getArticle(slug)
      .then((data) => {
        setArticle(data);
        document.title = `${data.title} | TechWissen`;
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const toc = useMemo(() => {
    if (!article?.content_markdown) return [];
    return article.content_markdown
      .split('\n')
      .filter((line) => /^##\s+/.test(line))
      .map((line) => {
        const title = line.replace(/^##\s+/, '').replace(/[`*_]/g, '');
        return { title, id: slugify(title) };
      });
  }, [article]);

  if (loading) return <main className="article-loading container"><Loading label="Artikel wird geladen …" /></main>;

  if (error || !article) {
    return (
      <main className="not-found container">
        <span>404</span>
        <h1>Artikel nicht gefunden</h1>
        <p>Der gewünschte Artikel existiert nicht oder ist nicht mehr verfügbar.</p>
        <a className="button-primary" href={appUrl("/")}>Zur Startseite</a>
      </main>
    );
  }

  const components = {
    pre: ({ children }) => <>{children}</>,
    h1: ({ children }) => null,
    h2: ({ children }) => {
      const text = nodeText(children);
      return <h2 id={slugify(text)}>{children}</h2>;
    },
    h3: ({ children }) => {
      const text = nodeText(children);
      return <h3 id={slugify(text)}>{children}</h3>;
    },
    code: ({ className, children }) => {
      const text = String(children);
      if (className || text.includes('\n')) return <CodeBlock className={className}>{children}</CodeBlock>;
      return <code className="inline-code">{children}</code>;
    },
    a: ({ href, children }) => {
      const resolvedHref = href?.startsWith('/') ? appUrl(href) : href;
      return <a href={resolvedHref} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{children}</a>;
    },
  };

  return (
    <main className="article-page">
      <div className="article-hero">
        <div className="container article-hero-inner">
          <a href={appUrl("/")} className="breadcrumb">TechWissen <span>/</span> {article.category_name}</a>
          <span className="category-pill">{article.category_name}</span>
          <h1>{article.title}</h1>
          <p>{article.excerpt}</p>
          <div className="article-meta">
            <span><Icon name="clock" size={17} /> {article.reading_time_minutes} Minuten</span>
            <span><Icon name="calendar" size={17} /> {formatDate(article.updated_at)}</span>
            <span>{article.difficulty}</span>
          </div>
          <div className="tag-row article-tags">
            {article.tags.map((tag) => <span key={tag.slug}>{tag.name}</span>)}
          </div>
        </div>
      </div>

      <div className="container article-layout">
        <aside className="toc">
          <strong>In diesem Artikel</strong>
          <nav>
            {toc.map((item) => <a key={item.id} href={`#${item.id}`}>{item.title}</a>)}
          </nav>
          <a className="toc-home" href={appUrl("/")}>← Alle Artikel</a>
        </aside>

        <article className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {article.content_markdown}
          </ReactMarkdown>
        </article>
      </div>
    </main>
  );
}
