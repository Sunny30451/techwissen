# TechWissen

Eine dockerisierte Fullstack-Wissensbasis für praxisnahe Artikel rund um Softwareentwicklung, Server, Linux, Docker, Datenbanken und DevOps.

## Stack

- **Frontend:** React 19 + Vite 8, statisch über Nginx ausgeliefert
- **Backend:** Node.js 24 LTS + Express 5
- **Datenbank:** PostgreSQL 18
- **Content:** Markdown in PostgreSQL, gerendert mit `react-markdown`
- **Deployment:** Docker Compose / Dokploy

## Funktionen

- Responsive Startseite und Artikelansicht
- Kategorien und Tags
- Artikelsuche über Titel, Kurzbeschreibung und Markdown-Inhalt
- Markdown inklusive Tabellen, Listen und Codeblöcken
- Kopierbutton für Codebeispiele
- Automatisch erzeugtes Inhaltsverzeichnis
- PostgreSQL-18-Persistenz über Named Volume am aktuellen offiziellen Volume-Pfad `/var/lib/postgresql`
- Healthchecks für Datenbank und Backend
- API nicht direkt öffentlich; Nginx proxyt `/api` intern zum Backend
- Seed-Artikel: „Universelle Docker-Entwicklungsumgebung auf Contabo mit Dokploy“

## Projektstruktur

```text
techwissen/
├── .env.example
├── docker-compose.yml
├── docker-compose.local.yml
├── README.md
├── docs/
│   └── CONCEPT.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── content/
│   │   └── dev-container-guide.md
│   └── src/
│       ├── db.js
│       ├── migrate.js
│       └── server.js
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── api.js
        ├── main.jsx
        ├── styles.css
        ├── components/
        └── pages/
```

## Lokal mit Docker starten

```bash
cp .env.example .env
```

Ändere mindestens `POSTGRES_PASSWORD` und starte anschließend:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build -d
```

Standardmäßig ist die Website nur an localhost gebunden:

```text
http://127.0.0.1:8080
```

Logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f
```

Stoppen:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml down
```

Datenbank inklusive Volume löschen:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml down -v
```

## Deployment mit Dokploy

1. Repository nach GitHub pushen.
2. In Dokploy ein Projekt und eine Docker-Compose-Anwendung erstellen.
3. Das Repository und `docker-compose.yml` auswählen.
4. Environment Variablen aus `.env.example` übernehmen.
5. **Nur `docker-compose.yml` deployen**; `docker-compose.local.yml` ist ausschließlich für lokale Host-Port-Freigaben gedacht.
6. In Dokploy nach Möglichkeit **Isolated Deployments** aktivieren.
7. Im Tab **Domains** eine Domain anlegen und als Service `frontend` sowie als Container-Port `80` auswählen.
8. HTTPS/Let's Encrypt aktivieren und neu deployen.

Das Produktions-Compose veröffentlicht absichtlich keinen Host-Port. Dokploy/Traefik routet intern direkt auf Port `80` des Frontend-Containers. Dadurch bleiben Backend (`3000`) und PostgreSQL (`5432`) ausschließlich im internen Docker-Netz.

## API

### Healthcheck

```http
GET /api/health
```

### Kategorien

```http
GET /api/categories
```

### Artikel

```http
GET /api/articles
GET /api/articles?search=docker
GET /api/articles?category=server-hosting
GET /api/articles?featured=true
```

### Einzelner Artikel

```http
GET /api/articles/docker-entwicklungsumgebung-contabo-dokploy
```

## Weitere Artikel ergänzen

Aktuell wird der erste Artikel in `backend/src/migrate.js` aus `backend/content/dev-container-guide.md` eingelesen und beim ersten Start als Seed-Datensatz in PostgreSQL gespeichert. Bereits vorhandene Artikel werden bei späteren Starts nicht überschrieben.

Für die nächste Ausbaustufe empfiehlt sich ein Adminbereich mit:

- Login/Rollen
- Artikel erstellen/bearbeiten/löschen
- Markdown-Editor mit Vorschau
- Draft/Published-Status
- SEO-Titel und Meta-Description
- Artikelbilder
- Versionshistorie

Das bestehende Datenmodell kann dafür erweitert werden, ohne Frontend und API grundsätzlich neu zu strukturieren.

## Sicherheitsnotizen

- Kein Standardpasswort produktiv verwenden.
- PostgreSQL wird im Compose nicht an den Host veröffentlicht.
- Das Backend wird ebenfalls nicht an den Host veröffentlicht; nur Nginx kommuniziert intern mit der API.
- Der Markdown-Renderer verwendet kein Raw-HTML-Plugin. Damit wird nicht ungeprüft beliebiges HTML aus Artikeln ausgeführt.
- Für einen späteren Adminbereich müssen Authentifizierung, Autorisierung, Rate Limiting und CSRF-/Session-Konzept ergänzt werden.
