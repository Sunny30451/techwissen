# TechWissen – Produktkonzept

## Produktidee

**TechWissen** ist eine deutschsprachige Wissensbasis für Software- und Servertechnologien. Der Schwerpunkt liegt nicht auf kurzen Copy-and-paste-Snippets, sondern auf nachvollziehbaren technischen Artikeln mit Architektur, Sicherheitsaspekten, Konfiguration und konkreten Beispielen.

Die Wissensbasis startet mit den Anleitungen **„Universelle Docker-Entwicklungsumgebung auf Contabo mit Dokploy“** und **„Ollama sicher mit Docker und Dokploy auf einem Contabo VPS bereitstellen“**.

## Zielgruppen

1. Anwendungsentwickler, die Server- und DevOps-Themen praktisch verstehen wollen.
2. Self-Hosting-Nutzer mit VPS/VDS/Dedicated Servern.
3. Entwickler, die reproduzierbare Entwicklungs- und Deployment-Umgebungen aufbauen.
4. Fortgeschrittene Einsteiger, die Zusammenhänge zwischen Frontend, Backend, Datenbank, Netzwerk und Infrastruktur lernen wollen.

## Informationsarchitektur

### Hauptbereiche

- **Server & Hosting** – Linux, VPS, SSH, Reverse Proxy, DNS, TLS, Firewalls
- **Softwareentwicklung** – Node.js, Java, Python, IDEs, Toolchains, APIs
- **Datenbanken** – PostgreSQL, Redis, SQL, Migrationen, Backups, Performance
- **DevOps** – Docker, Compose, Dokploy, CI/CD, GitHub Actions, Observability

### Artikel-Metadaten

Jeder Artikel besitzt:

- Titel
- eindeutigen Slug
- Kurzbeschreibung
- Markdown-Inhalt
- Kategorie
- Schwierigkeitsgrad
- geschätzte Lesezeit
- Tags
- Veröffentlichungs- und Änderungsdatum
- Featured-Status

## UX-Konzept

### Startseite

Die Startseite dient gleichzeitig als Landingpage und Wissensindex:

1. Hero mit klarer Positionierung.
2. Volltextsuche.
3. Themenbereiche mit Artikelanzahl.
4. Featured-Artikel als prominentester Einstieg.
5. Artikelliste mit Kategorie, Tags, Schwierigkeit und Lesezeit.
6. Erläuterung des redaktionellen Ansatzes.

### Artikelseite

Eine Artikelseite enthält:

- Kategorie und Tags
- Titel und Kurzbeschreibung
- Lesezeit und Schwierigkeit
- automatisch erzeugtes Inhaltsverzeichnis
- Markdown mit Tabellen, Listen und Codeblöcken
- Kopierfunktion für Codeblöcke
- responsive Darstellung für Desktop, Tablet und Smartphone

## Technische Architektur

```text
Browser
   │
   │ HTTPS
   ▼
Dokploy / Traefik
   │
   ▼
Nginx Frontend :80
   │
   ├── React SPA
   │
   └── /api/* ─────► Node.js / Express :3000
                         │
                         ▼
                    PostgreSQL :5432
```

Nur das Frontend ist über Traefik erreichbar. Backend und Datenbank befinden sich ausschließlich im internen Docker-Netz.

## Backend-API

Die öffentliche API bleibt read-only:

- `GET /api/health`
- `GET /api/categories`
- `GET /api/articles`
- `GET /api/articles?search=...`
- `GET /api/articles?category=...`
- `GET /api/articles/:slug`

Zusätzlich existiert ein geschützter Redaktionsbereich unter `/admin`. Schreibzugriffe laufen ausschließlich über `/api/admin/*` und erfordern nach dem Login ein zeitlich begrenztes HMAC-signiertes Bearer-Token. Der Adminbereich stellt CRUD-Endpunkte für Artikel und Kategorien bereit.

## Datenhaltung

PostgreSQL verwaltet Kategorien, Artikel und Tags relational. Der Artikeltext liegt als Markdown in der Datenbank. Das bietet zwei Vorteile:

1. Inhalte bleiben unabhängig vom React-Build.
2. Der vorhandene Adminbereich kann Inhalte direkt bearbeiten, ohne das Frontend neu zu deployen.

Die quellversionierten Startartikel werden beim initialen Start aus Markdown-Dateien geseedet. Bereits vorhandene Artikel werden beim normalen Neustart nicht überschrieben. Für den Ollama-Artikel existiert zusätzlich ein idempotentes Importskript, das eine bereits laufende Datenbank gezielt aktualisieren kann.

## Sicherheitskonzept der ersten Version

- PostgreSQL besitzt keine Host-Port-Freigabe.
- Das Backend besitzt keine Host-Port-Freigabe.
- Nginx proxyt `/api` intern zum Backend.
- Produktiv wird der Frontend-Port über Dokploy/Traefik geroutet.
- Datenbankpasswort ist eine erforderliche Environment Variable.
- Admin-Benutzername, Admin-Passwort und Session-Secret werden ausschließlich über Environment Variablen bereitgestellt.
- Admin-Tokens sind HMAC-signiert und laufen nach 12 Stunden ab.
- Fehlgeschlagene Admin-Logins werden pro IP begrenzt.
- React-Markdown rendert kein ungeprüftes Raw HTML.
- Nginx setzt grundlegende Security Header und eine restriktive Content Security Policy.
- Express setzt zusätzliche Security Header über Helmet.

## Vorgesehene Ausbaustufen

### Phase 2 – Redaktion

Bereits umgesetzt:

- Administrator-Login
- Artikel erstellen, bearbeiten und löschen
- Kategorien erstellen, bearbeiten und löschen
- Markdown-Editor mit Vorschau
- Tags, Lesezeit, Schwierigkeitsgrad und Featured-Status

Noch vorgesehen:

- Rollen und Berechtigungen
- Draft/Published-Workflow
- Artikelarchiv statt Hard Delete
- SEO-Titel und Meta-Description
- Titelbilder und Assets
- Versionshistorie

### Phase 3 – Wissensnavigation

- verwandte Artikel
- Serien und Lernpfade
- Tag-Seiten
- „Nächster Artikel“-Navigation
- PostgreSQL Full Text Search
- Suchvorschläge

### Phase 4 – Betrieb

- automatisierte Datenbank-Backups
- strukturierte Migrationen mit eigener Migrationstabelle/Tool
- CI/CD-Pipeline
- Health-/Readiness-Monitoring
- Logging und Fehlertracking
- Rate Limiting für öffentliche API-Endpunkte

### Phase 5 – Benutzerfunktionen

Nur falls später benötigt:

- Benutzerkonten
- Lesezeichen
- Lesefortschritt
- Kommentare oder Feedback
- persönliche Lernlisten

## Designrichtung

Das Interface verwendet eine dunkle, sachliche Entwickler-Ästhetik mit:

- hoher typografischer Hierarchie
- monochromen Flächen
- dezenten Gittern und Terminal-Anspielungen
- Grün als primärer technischer Akzent
- Blau als sekundärer Akzent
- wenig dekorativen Elementen
- Fokus auf langen, gut lesbaren Fachartikeln

Die Gestaltung soll wie eine technische Dokumentationsplattform wirken, nicht wie ein Marketing-Blog.
