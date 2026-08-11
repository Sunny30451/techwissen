import { appUrl } from '../config.js';
import Icon from './Icon.jsx';

export default function ArticleCard({ article, featured = false }) {
  return (
    <article className={featured ? 'article-card featured-card' : 'article-card'}>
      <div className="card-topline">
        <span className="category-pill">{article.category_name}</span>
        {article.featured && <span className="featured-label">Empfohlen</span>}
      </div>
      <h3>{article.title}</h3>
      <p>{article.excerpt}</p>
      <div className="tag-row">
        {article.tags?.slice(0, 5).map((tag) => <span key={tag.slug}>{tag.name}</span>)}
      </div>
      {(article.repository_url || article.has_package) && (
        <div className="card-resource-row">
          {article.repository_url && <span>Repository</span>}
          {article.has_package && <span>Dokploy ZIP</span>}
        </div>
      )}
      <div className="card-footer">
        <div className="meta-inline">
          <span><Icon name="clock" size={16} /> {article.reading_time_minutes} Min.</span>
          <span>{article.difficulty}</span>
        </div>
        <a className="read-link" href={appUrl(`/artikel/${article.slug}`)}>
          Lesen <Icon name="arrow" size={17} />
        </a>
      </div>
    </article>
  );
}
