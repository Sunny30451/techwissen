import { useEffect, useState } from 'react';
import { getArticles, getCategories } from '../api.js';
import ArticleCard from '../components/ArticleCard.jsx';
import Icon from '../components/Icon.jsx';
import Loading from '../components/Loading.jsx';

const categoryIcons = {
  'server-hosting': 'server',
  softwareentwicklung: 'code',
  datenbanken: 'database',
  devops: 'branch',
};

export default function HomePage() {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getCategories().then(setCategories).catch(() => setError('Kategorien konnten nicht geladen werden.'));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    getArticles({ search: activeSearch, category })
      .then(setArticles)
      .catch(() => setError('Artikel konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [activeSearch, category]);

  function submitSearch(event) {
    event.preventDefault();
    setActiveSearch(search.trim());
  }

  const featured = articles.find((article) => article.featured);
  const rest = articles.filter((article) => article.id !== featured?.id);

  return (
    <main>
      <section className="hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="container hero-content">
          <div className="eyebrow"><span /> TECHNISCHES WISSEN, PRAXISNAH ERKLÄRT</div>
          <h1>Software und Server<br /><em>wirklich verstehen.</em></h1>
          <p className="hero-copy">
            Fundierte Anleitungen zu Entwicklung, Linux, Docker, Datenbanken und DevOps – mit Architektur,
            Konfiguration und nachvollziehbaren Beispielen statt oberflächlicher Kurzrezepte.
          </p>
          <form className="search-box" onSubmit={submitSearch}>
            <Icon name="search" size={21} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Artikel durchsuchen, z. B. Docker, SSH, PostgreSQL …"
              aria-label="Artikel durchsuchen"
            />
            <button type="submit">Suchen</button>
          </form>
          <div className="hero-stats">
            <span><strong>{articles.length}</strong> Artikel</span>
            <span><strong>{categories.length}</strong> Themenbereiche</span>
            <span><strong>100%</strong> praxisorientiert</span>
          </div>
        </div>
      </section>

      <section className="section container" id="kategorien">
        <div className="section-heading">
          <div><span className="section-kicker">THEMENBEREICHE</span><h2>Wissen nach Technologie</h2></div>
          {(category || activeSearch) && (
            <button className="reset-filter" onClick={() => { setCategory(''); setSearch(''); setActiveSearch(''); }}>
              Filter zurücksetzen
            </button>
          )}
        </div>
        <div className="category-grid">
          {categories.map((item) => (
            <button
              key={item.slug}
              className={category === item.slug ? 'category-card active' : 'category-card'}
              onClick={() => setCategory(category === item.slug ? '' : item.slug)}
            >
              <span className="category-icon"><Icon name={categoryIcons[item.slug] || 'code'} size={25} /></span>
              <span className="category-copy">
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </span>
              <span className="category-count">{item.article_count}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section articles-section" id="artikel">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">WISSENSBASIS</span>
              <h2>{activeSearch ? `Suchergebnisse für „${activeSearch}“` : category ? 'Gefilterte Artikel' : 'Aktuelle Artikel'}</h2>
            </div>
            <span className="result-count">{articles.length} Treffer</span>
          </div>

          {loading && <Loading />}
          {error && <div className="error-box">{error}</div>}
          {!loading && !error && !articles.length && (
            <div className="empty-state">
              <h3>Keine Artikel gefunden</h3>
              <p>Versuche einen anderen Suchbegriff oder setze den Filter zurück.</p>
            </div>
          )}

          {!loading && featured && !activeSearch && !category && (
            <div className="featured-wrap">
              <ArticleCard article={featured} featured />
              <aside className="featured-aside">
                <span className="terminal-dotline"><i /><i /><i /></span>
                <pre>{`$ ssh dev-base\nConnected to Ubuntu 24.04\n\n$ node --version\nv24.18.1\n\n$ gh auth status\n✓ Logged in\n\n$ docker compose up -d\n✓ environment ready`}</pre>
              </aside>
            </div>
          )}

          <div className="article-grid">
            {(activeSearch || category ? articles : rest).map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      </section>

      <section className="principles container">
        <div>
          <span className="section-kicker">ANSATZ</span>
          <h2>Nicht nur das „Wie“, sondern auch das „Warum“.</h2>
        </div>
        <div className="principle-grid">
          <div><span>01</span><strong>Architektur zuerst</strong><p>Zusammenhänge verstehen, bevor einzelne Befehle kopiert werden.</p></div>
          <div><span>02</span><strong>Reproduzierbar</strong><p>Konfiguration und Infrastruktur werden versionierbar beschrieben.</p></div>
          <div><span>03</span><strong>Sicher betreiben</strong><p>Netzwerkgrenzen, Secrets und unnötig offene Ports werden bewusst behandelt.</p></div>
        </div>
      </section>
    </main>
  );
}
