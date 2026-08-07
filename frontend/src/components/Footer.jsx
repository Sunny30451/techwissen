export default function Footer() {
  return (
    <footer className="site-footer" id="ueber">
      <div className="container footer-grid">
        <div>
          <div className="brand footer-brand">
            <span className="brand-mark">TW</span>
            <span><strong>TechWissen</strong><small>Praxisnah. Technisch. Nachvollziehbar.</small></span>
          </div>
          <p>Eine erweiterbare Wissensbasis für Softwareentwicklung, Server, Datenbanken und DevOps.</p>
        </div>
        <div>
          <strong>Technologie</strong>
          <p>React · Node.js · Express · PostgreSQL · Docker</p>
        </div>
        <div>
          <strong>Betrieb</strong>
          <p>Optimiert für Docker Compose und Dokploy auf einem Linux-VPS.</p>
        </div>
      </div>
    </footer>
  );
}
