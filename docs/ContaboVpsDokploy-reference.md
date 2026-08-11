# ContaboVpsDokploy – Referenz

## Infrastruktur

TechWissen läuft als Docker-Compose-Anwendung auf einem Ubuntu-Contabo-VPS unter Dokploy/Traefik.

```text
Traefik -> frontend:80 -> backend:3000 -> PostgreSQL:5432
```

Nur der Frontend-Service wird über Dokploy öffentlich geroutet. Backend und PostgreSQL besitzen keine öffentlichen Host-Port-Mappings.

## Öffentliche URL

Die einzige öffentliche URL-Konfiguration der TechWissen-Anwendung ist:

```env
APP_BASE_URL=/repositoryname
```

Der Wert von `APP_BASE_URL` wird automatisch von Vite und Nginx verwendet.

Wenn `APP_BASE_URL` fehlt, verwendet TechWissen als Fallback den Repository-Namen:

```text
https://DOMAIN/<repositoryname>
```

Die Domain wird in diesem Fall durch die Dokploy-Domain-Konfiguration bestimmt.

## Dokploy Domain Mapping

```text
Service:        frontend
Container Port: 80
Domain:         in Dokploy konfigurierte Domain
Path:           APP_BASE_URL bzw. /<repositoryname>
Strip Path:     OFF
HTTPS:          ON
```

Öffentliche Routen werden relativ zu `APP_BASE_URL` aufgebaut:

```text
APP_BASE_URL/
APP_BASE_URL/admin
APP_BASE_URL/artikel/<slug>
APP_BASE_URL/api/...
```

## Environment

```env
APP_BASE_URL=
POSTGRES_DB=techwissen
POSTGRES_USER=techwissen
POSTGRES_PASSWORD=<secret>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<secret>
ADMIN_SESSION_SECRET=<secret>
```

Secrets gehören ausschließlich in die Dokploy-Environment-/Secret-Konfiguration und nicht in Git.

## Artikelworkflow

- Markdown-Quelldateien: `backend/content/`
- Importskripte: `backend/scripts/`
- Kategorie per Slug upserten
- Artikel per Slug upserten
- `article_tags` neu aufbauen
- Tags per Slug upserten
- Import transaktional und idempotent ausführen

## Interne Dienste

Ollama besitzt keine öffentliche Dokploy-Domain und kein Host-Port-Mapping. Berechtigte Container greifen über das externe interne Docker-Netz `ollama-internal` auf `http://ollama:11434` zu.


## TechWissen Artikelressourcen

- Repository-URLs werden direkt am Artikel in PostgreSQL persistiert.
- Dokploy-/ZIP-Pakete liegen im persistenten Named Volume `article-packages`; PostgreSQL speichert nur Zuordnung und Metadaten.
- Paketdownloads erfolgen über die bestehende `APP_BASE_URL/api/...`-Route. Es wird kein zusätzlicher öffentlicher Port benötigt.
- Standardlimits: `ARTICLE_PACKAGE_MAX_MB=100`, `ARTICLE_MARKDOWN_MAX_MB=2`.
- Beim Backup sind `postgres-data` und `article-packages` gemeinsam zu berücksichtigen.
