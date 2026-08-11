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
- optionale Repository-URL pro Artikel, persistent in PostgreSQL
- optionales Dokploy-/ZIP-Paket pro Artikel mit öffentlichem Download und SHA-256-Prüfsumme
- validierter `.md`-Import beim Anlegen eines neuen Artikels nach TechWissen-Artikelstruktur
- Kategorien anlegen, bearbeiten und unbenutzte Kategorien löschen
- Kategorien und Tags
- Artikelsuche über Titel, Kurzbeschreibung und Markdown-Inhalt
- Markdown inklusive Tabellen, Listen und Codeblöcken
- Kopierbutton für Codebeispiele
- Automatisch erzeugtes Inhaltsverzeichnis
- PostgreSQL-18-Persistenz über Named Volume am aktuellen offiziellen Volume-Pfad `/var/lib/postgresql`
- persistenter Dateispeicher für Artikelpakete über das Named Volume `article-packages`
- Healthchecks für Datenbank und Backend
- API nicht direkt öffentlich; Nginx proxyt `/api` intern zum Backend
- Quellversionierte Startartikel:
  - „Universelle Docker-Entwicklungsumgebung auf Contabo mit Dokploy“
  - „Ollama sicher mit Docker und Dokploy auf einem Contabo VPS bereitstellen“
  - „n8n mit Docker und Dokploy auf einem Contabo VPS bereitstellen“

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
│       ├── article-files.js
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
http://127.0.0.1:8080/techwissen
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
7. Im Tab **Domains** eine Domain anlegen und konfigurieren:
   - Service: `frontend`
   - Container-Port: `80`
   - Path: exakt der Pfadanteil von `APP_BASE_URL` (oder `/<repositoryname>` beim Fallback)
   - Strip Path: **OFF**
8. HTTPS/Let's Encrypt aktivieren und neu deployen.

Das Produktions-Compose veröffentlicht absichtlich keinen Host-Port. Dokploy/Traefik routet intern direkt auf Port `80` des Frontend-Containers. Dadurch bleiben Backend (`3000`) und PostgreSQL (`5432`) ausschließlich im internen Docker-Netz.

## Adminbereich

Der Redaktionsbereich ist nach dem Deployment unter folgender Route erreichbar:

```text
APP_BASE_URL/admin
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
- Repository-URL je Artikel setzen oder entfernen
- Dokploy-/ZIP-Paket auswählen, hochladen, ersetzen oder entfernen
- beim Anlegen eines neuen Artikels eine `.md`-Datei hochladen und serverseitig gegen die TechWissen-Vorlagenstruktur validieren
- Markdown-Inhalt mit Vorschau bearbeiten
- Kategorie, Tags, Schwierigkeitsgrad und Lesezeit setzen
- Veröffentlichungszeitpunkt ändern
- Featured-Status setzen
- Artikel löschen
- Kategorien erstellen
- Kategorien bearbeiten
- unbenutzte Kategorien löschen

Eine Kategorie, der noch Artikel zugeordnet sind, kann nicht gelöscht werden. PostgreSQL verhindert dies zusätzlich durch den vorhandenen Foreign Key.

### Artikelressourcen und Datei-Uploads

Die Repository-Adresse wird im Feld `articles.repository_url` gespeichert. ZIP-Pakete werden nicht als Binärdaten in PostgreSQL abgelegt. PostgreSQL enthält nur die Dateimetadaten und die Zuordnung zum Artikel; die eigentliche Datei liegt im Named Volume `article-packages`.

Standardlimits:

```env
ARTICLE_PACKAGE_MAX_MB=100
ARTICLE_MARKDOWN_MAX_MB=2
```

Ein Dokploy-Paket muss auf `.zip` enden und zusätzlich eine gültige ZIP-Signatur besitzen. Beim Upload speichert TechWissen eine SHA-256-Prüfsumme. Wird ein Paket ersetzt oder entfernt, wird auch die alte Datei aus dem persistenten Dateispeicher entfernt.

Der Markdown-Import für **Neuer Artikel** übernimmt eine Datei nur in den Editor, wenn die Pflichtstruktur erfüllt ist. Geprüft werden unter anderem: gültiges UTF-8, genau eine H1-Überschrift, zentrale TechWissen-Abschnitte, keine verbliebenen `{{...}}`-Template-Platzhalter und ausgeglichene dreifache Backtick-Codeblöcke. Kategorie, Tags, Repository-URL und weitere Metadaten werden anschließend weiterhin im Adminformular festgelegt.

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
GET /api/articles/:slug/package
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
POST   /api/admin/articles/import-markdown
POST   /api/admin/articles/:id/package
DELETE /api/admin/articles/:id/package
```

## Quellversionierte Artikel und Importskripte

Die quellversionierten Artikel liegen als Markdown unter `backend/content/` und werden bei einer neuen Datenbank durch `backend/src/migrate.js` als Seed-Datensätze angelegt. Bereits vorhandene Artikel werden beim normalen Backend-Start nicht überschrieben.

Der Ollama-Artikel besitzt zusätzlich ein idempotentes Import-/Update-Skript. Damit kann der Artikel auf einer bereits laufenden TechWissen-Datenbank gezielt veröffentlicht oder auf die aktuelle Markdown-Version aktualisiert werden:

```bash
docker compose exec backend npm run import:ollama
```

In Dokploy kann derselbe Befehl über den Terminalzugriff des `backend`-Services ausgeführt werden:

```bash
npm run import:ollama
```

Das Skript führt ein Upsert anhand des Slugs `ollama-docker-dokploy-contabo-intern` durch und synchronisiert die Tags. Dadurch kann es mehrfach sicher ausgeführt werden.

Der n8n-Artikel besitzt ebenfalls ein idempotentes Import-/Update-Skript. Es legt bei Bedarf zusätzlich die Kategorie `Automation & AI` an und synchronisiert die Artikel-Tags:

```bash
docker compose exec backend npm run import:n8n
```

Im Dokploy-Terminal des Backend-Services:

```bash
npm run import:n8n
```

Der verwendete Artikel-Slug lautet `n8n-docker-dokploy-contabo-ollama-llm`.

Als nächste Ausbaustufe des vorhandenen Adminbereichs bieten sich Rollen/Rechte, Draft-/Published-Status, SEO-Metadaten, Artikelbilder und eine Versionshistorie an. Das bestehende Datenmodell kann dafür schrittweise erweitert werden.

## Sicherheitsnotizen

- Kein Standardpasswort produktiv verwenden.
- PostgreSQL wird im Compose nicht an den Host veröffentlicht.
- Das Backend wird ebenfalls nicht an den Host veröffentlicht; nur Nginx kommuniziert intern mit der API.
- Der Markdown-Renderer verwendet kein Raw-HTML-Plugin. Damit wird nicht ungeprüft beliebiges HTML aus Artikeln ausgeführt.
- Der Adminbereich verwendet Bearer-Tokens statt Cookies. Admin-Passwort und Session-Secret gehören ausschließlich in Dokploy-Secrets/Environment-Variablen und niemals ins Repository.
- `/admin` produktiv ausschließlich über HTTPS verwenden.
- Der einfache In-Memory-Login-Rate-Limiter ist für eine einzelne Backend-Instanz ausgelegt; bei horizontaler Skalierung sollte er durch Redis oder einen vorgelagerten Rate Limiter ersetzt werden.

---

## Betrieb mit `APP_BASE_URL`

TechWissen verwendet für die öffentliche Adresse ausschließlich eine Konfigurationsvariable:

```env
APP_BASE_URL=https://DOMAIN/repositoryname
```

Beispiel:

```env
APP_BASE_URL=https://example.com/techwissen
```

Der Pfadanteil wird beim Build automatisch für Vite, Nginx, API-Aufrufe, Navigation, Admin- und Artikel-URLs verwendet. Im Quellcode existiert kein fest verdrahteter Deployment-Unterpfad.

### Fallback auf Repository-Namen

Wird `APP_BASE_URL` nicht gesetzt, verwendet die Anwendung automatisch den Repository-Namen als Pfad. Für das Repository `techwissen` ergibt sich auf der in Dokploy gewählten Domain:

```text
https://DOMAIN/techwissen
```

Der Repository-Name wird bevorzugt aus dem Git-Remote `origin` gelesen. Falls die Git-Metadaten im Build-Kontext nicht vorhanden sind, dient der im Frontend-Paket hinterlegte Repository-Name als Fallback.

### Dokploy Domain-Konfiguration

Bei:

```env
APP_BASE_URL=https://example.com/techwissen
```

konfigurierst du im Dokploy-Domains-Tab:

```text
Service:        frontend
Domain:         example.com
Path:           /techwissen
Container Port: 80
Strip Path:     OFF
HTTPS:          ON
```

Ohne `APP_BASE_URL` muss `Path` auf `/<repositoryname>` gesetzt werden. Dokploy/Traefik entfernt den Prefix nicht; Nginx verarbeitet denselben Prefix intern und leitet den API-Bereich an `backend:3000/api` weiter.

### Öffentliche Routen

Alle Routen werden relativ zu `APP_BASE_URL` erzeugt:

```text
APP_BASE_URL/
APP_BASE_URL/admin
APP_BASE_URL/artikel/<slug>
APP_BASE_URL/api/...
```

### Environment-Variablen

```env
APP_BASE_URL=https://example.com/techwissen
POSTGRES_DB=techwissen
POSTGRES_USER=techwissen
POSTGRES_PASSWORD=<langes-zufälliges-passwort>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<separates-langes-passwort>
ADMIN_SESSION_SECRET=<langes-zufälliges-secret>
```

`APP_BASE_URL` darf leer bleiben, wenn der Repository-Fallback verwendet werden soll. Eine Änderung der URL erfordert einen Frontend-Rebuild/Redeploy, weil Vite den öffentlichen Asset-Pfad in das Build-Ergebnis einbettet.

### Enthaltene quellversionierte Artikel

Beim ersten Start werden die aktuellen Artikel automatisch angelegt:

1. Universelle Docker-Entwicklungsumgebung auf Contabo mit Dokploy
2. Ollama sicher mit Docker und Dokploy auf einem Contabo VPS bereitstellen
3. n8n mit Docker und Dokploy auf einem Contabo VPS bereitstellen

Die separaten Imports für Ollama und n8n bleiben zusätzlich verfügbar:

```bash
npm run import:ollama
npm run import:n8n
```
