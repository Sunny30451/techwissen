import { useState } from 'react';
import Icon from './Icon.jsx';
import { appUrl } from '../app-url.js';

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="brand" href={appUrl()} aria-label="TechWissen Startseite">
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
          <a href={appUrl('#artikel')}>Artikel</a>
          <a href={appUrl('#kategorien')}>Kategorien</a>
          <a href={appUrl('#ueber')}>Über das Projekt</a>
          <a href={appUrl('/admin')}>Admin</a>
        </nav>
      </div>
    </header>
  );
}