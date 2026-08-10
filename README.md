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
- Quellversionierte Startartikel:
  - „Universelle Docker-Entwicklungsumgebung auf Contabo mit Dokploy“
  - „Ollama sicher mit Docker und Dokploy auf einem Contabo VPS bereitstellen“

## Projektstruktur

```text
techwissen/
├── .env.example
├── docker-compose.yml
├── docker-compose.local.yml
├── README.md
├── docs/
│   └── CONCEPT.md
├── examples/
│   └── ollama-dokploy/
│       ├── docker-compose.yml
│       ├── .env.example
│       ├── create-network.sh
│       └── client-compose-snippet.yml
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── content/
│   │   ├── dev-container-guide.md
│   │   └── ollama-dokploy-contabo.md
│   ├── scripts/
│   │   └── import-ollama-article.js
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

### Deployment unter einem URL-Pfad

Wenn die Anwendung nicht auf der Domain-Wurzel, sondern beispielsweise unter `https://example.com/tech-test/` erreichbar sein soll, muss in Dokploy gesetzt werden:

```env
APP_BASE_URL=/tech-test
```

Der Wert muss dem öffentlichen Pfad aus der Dokploy-Domainkonfiguration entsprechen. Für ein Deployment auf der Domain-Wurzel bleibt der Wert `/`. `APP_BASE_URL` wird sowohl beim Vite-Build als auch zur Laufzeit von Nginx verwendet; nach einer Änderung ist deshalb ein vollständiger Rebuild erforderlich, ein reiner Container-Neustart reicht nicht.

Empfohlene Dokploy-Domainkonfiguration für das Beispiel:

- **Path:** `/tech-test`
- **Container Port:** `80`
- **Strip Path:** aktiviert

Nginx akzeptiert beide Varianten, sodass die Anwendung auch funktioniert, wenn Dokploy den Pfad nicht entfernt. Nach dem Deployment müssen `/tech-test/`, die im HTML referenzierten Dateien unter `/tech-test/assets/`, `/tech-test/api/health` und ein Deep Link unter `/tech-test/artikel/...` erreichbar sein. Nicht vorhandene Asset-Dateien liefern absichtlich einen echten HTTP-404 statt des SPA-HTML-Dokuments.

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
GET /api/articles/ollama-docker-dokploy-contabo-intern
```

## Quellversionierte Artikel und Importskripte

Die beiden vorhandenen Artikel liegen als Markdown unter `backend/content/` und werden bei einer neuen Datenbank durch `backend/src/migrate.js` als Seed-Datensätze angelegt. Bereits vorhandene Artikel werden beim normalen Backend-Start nicht überschrieben.

Der Ollama-Artikel besitzt zusätzlich ein idempotentes Import-/Update-Skript. Damit kann der Artikel auf einer bereits laufenden TechWissen-Datenbank gezielt veröffentlicht oder auf die aktuelle Markdown-Version aktualisiert werden:

```bash
docker compose exec backend npm run import:ollama
```

In Dokploy kann derselbe Befehl über den Terminalzugriff des `backend`-Services ausgeführt werden:

```bash
npm run import:ollama
```

Das Skript führt ein Upsert anhand des Slugs `ollama-docker-dokploy-contabo-intern` durch und synchronisiert die Tags. Dadurch kann es mehrfach sicher ausgeführt werden.

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
