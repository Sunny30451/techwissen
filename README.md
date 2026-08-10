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
- Geschützter Adminbereich unter `/admin`
- Artikel anlegen, bearbeiten, löschen und als Markdown vorab anzeigen
- Kategorien anlegen, bearbeiten und unbenutzte Kategorien löschen
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

Ändere mindestens `POSTGRES_PASSWORD`, `ADMIN_PASSWORD` und `ADMIN_SESSION_SECRET` und starte anschließend:

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
4. Environment Variablen aus `.env.example` übernehmen. Insbesondere `POSTGRES_PASSWORD`, `ADMIN_PASSWORD` und `ADMIN_SESSION_SECRET` mit langen, zufälligen Werten setzen.
5. **Nur `docker-compose.yml` deployen**; `docker-compose.local.yml` ist ausschließlich für lokale Host-Port-Freigaben gedacht.
6. In Dokploy nach Möglichkeit **Isolated Deployments** aktivieren.
7. Im Tab **Domains** eine Domain anlegen und als Service `frontend` sowie als Container-Port `80` auswählen.
8. HTTPS/Let's Encrypt aktivieren und neu deployen.

Das Produktions-Compose veröffentlicht absichtlich keinen Host-Port. Dokploy/Traefik routet intern direkt auf Port `80` des Frontend-Containers. Dadurch bleiben Backend (`3000`) und PostgreSQL (`5432`) ausschließlich im internen Docker-Netz.

## Adminbereich

Der Redaktionsbereich ist nach dem Deployment unter folgender Route erreichbar:

```text
https://DEINE-DOMAIN/admin
```

Die Zugangsdaten werden **nicht** in der Datenbank gespeichert, sondern als Dokploy-Environment-Variablen an das Backend übergeben:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ein-sehr-langes-zufaelliges-passwort
ADMIN_SESSION_SECRET=ein-separates-langes-zufaelliges-secret
```

Nach erfolgreicher Anmeldung erzeugt das Backend ein HMAC-signiertes, auf 12 Stunden begrenztes Bearer-Token. Das Frontend speichert dieses Token nur in `sessionStorage`; beim Schließen des Browser-Tabs beziehungsweise der Browser-Sitzung wird es entfernt. Der Adminbereich verwendet keine Cookie-Session und benötigt deshalb für diese API-Schreibzugriffe kein separates CSRF-Token.

Im Adminbereich können aktuell verwaltet werden:

- Artikel erstellen
- Artikel vollständig bearbeiten
- Markdown-Inhalt mit Vorschau bearbeiten
- Kategorie, Tags, Schwierigkeitsgrad und Lesezeit setzen
- Veröffentlichungszeitpunkt ändern
- Featured-Status setzen
- Artikel löschen
- Kategorien erstellen
- Kategorien bearbeiten
- unbenutzte Kategorien löschen

Eine Kategorie, der noch Artikel zugeordnet sind, kann nicht gelöscht werden. PostgreSQL verhindert dies zusätzlich durch den vorhandenen Foreign Key.

### Admin-Login absichern

Der Login besitzt ein einfaches serverseitiges Rate Limit: Nach fünf fehlgeschlagenen Versuchen innerhalb eines 15-Minuten-Fensters werden weitere Anmeldeversuche für diese IP temporär blockiert. Produktiv sollte `/admin` ausschließlich über die HTTPS-Domain von Dokploy aufgerufen werden.

Nach einer Änderung von `ADMIN_PASSWORD` oder `ADMIN_SESSION_SECRET` verlieren bestehende Admin-Tokens automatisch ihre Gültigkeit.

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

### Admin API

Alle Routen außer dem Login erwarten:

```http
Authorization: Bearer <ADMIN-TOKEN>
```

```http
POST   /api/admin/login
GET    /api/admin/session
GET    /api/admin/categories
POST   /api/admin/categories
PUT    /api/admin/categories/:id
DELETE /api/admin/categories/:id
GET    /api/admin/articles
GET    /api/admin/articles/:id
POST   /api/admin/articles
PUT    /api/admin/articles/:id
DELETE /api/admin/articles/:id
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

Als nächste Ausbaustufe des vorhandenen Adminbereichs bieten sich Rollen/Rechte, Draft-/Published-Status, SEO-Metadaten, Artikelbilder und eine Versionshistorie an. Das bestehende Datenmodell kann dafür schrittweise erweitert werden.

## Sicherheitsnotizen

- Kein Standardpasswort produktiv verwenden.
- PostgreSQL wird im Compose nicht an den Host veröffentlicht.
- Das Backend wird ebenfalls nicht an den Host veröffentlicht; nur Nginx kommuniziert intern mit der API.
- Der Markdown-Renderer verwendet kein Raw-HTML-Plugin. Damit wird nicht ungeprüft beliebiges HTML aus Artikeln ausgeführt.
- Der Adminbereich verwendet Bearer-Tokens statt Cookies. Admin-Passwort und Session-Secret gehören ausschließlich in Dokploy-Secrets/Environment-Variablen und niemals ins Repository.
- `/admin` produktiv ausschließlich über HTTPS verwenden.
- Der einfache In-Memory-Login-Rate-Limiter ist für eine einzelne Backend-Instanz ausgelegt; bei horizontaler Skalierung sollte er durch Redis oder einen vorgelagerten Rate Limiter ersetzt werden.
