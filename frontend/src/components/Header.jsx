import { useState } from 'react';
import Icon from './Icon.jsx';

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="brand" href="/" aria-label="TechWissen Startseite">
          <span className="brand-mark">TW</span>
          <span>
            <strong>TechWissen</strong>
            <small>Software & Server erklärt</small>
          </span>
        </a>

        <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Navigation öffnen">
          <Icon name={open ? 'close' : 'menu'} />
        </button>

        <nav className={open ? 'main-nav is-open' : 'main-nav'}>
          <a href="/#artikel">Artikel</a>
          <a href="/#kategorien">Kategorien</a>
          <a href="/#ueber">Über das Projekt</a>
        </nav>
      </div>
    </header>
  );
}
