# TechWissen – Dokploy Deployment mit `APP_BASE_URL`

## 1. Grundprinzip

`APP_BASE_URL` ist bei TechWissen **kein vollständiger URL**, sondern ausschließlich der Anwendungspfad unter der in Dokploy konfigurierten Domain.

Beispiel:

```env
APP_BASE_URL=/tech
```

Dokploy stellt dazu Domain und HTTPS bereit:

```text
https://DOMAIN/tech
```

## 2. Environment in Dokploy

Beispiel:

```env
APP_BASE_URL=/tech
POSTGRES_DB=techwissen
POSTGRES_USER=techwissen
POSTGRES_PASSWORD=<secret>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<secret>
ADMIN_SESSION_SECRET=<secret>
ARTICLE_PACKAGE_MAX_MB=100
ARTICLE_MARKDOWN_MAX_MB=2
```

Secrets ausschließlich im Dokploy-Environment/Secret-Management pflegen und nicht in Git speichern.

## 3. Fallback ohne `APP_BASE_URL`

Ist `APP_BASE_URL` leer oder nicht definiert, wird der Repository-Name als Pfad verwendet:

```text
/<repositoryname>
```

Für `techwissen`:

```text
/techwissen
```

Die Domain wird nicht aus dem Quellcode abgeleitet, sondern in Dokploy ausgewählt.

## 4. Domain Mapping in Dokploy

Bei `APP_BASE_URL=/tech`:

```text
Service:        frontend
Container Port: 80
Domain:         DOMAIN
Path:           /tech
Strip Path:     OFF
HTTPS:          ON
```

Beim Fallback muss `Path` auf `/<repositoryname>` gesetzt werden.

Nur `frontend:80` wird durch Dokploy/Traefik geroutet. `backend:3000` und PostgreSQL `5432` bleiben im privaten Compose-Netz und erhalten keine Host-Port-Freigabe.

## 5. Öffentliche Routen

Bei `APP_BASE_URL=/tech` und Domain `example.com` entstehen:

```text
https://example.com/tech/
https://example.com/tech/admin
https://example.com/tech/artikel/<slug>
https://example.com/tech/api/health
https://example.com/tech/api/articles
```

Intern kennt die Anwendung nur den Prefix `/tech`. Die Domain gehört zur Reverse-Proxy-Konfiguration.

## 6. Änderungen

Änderungen von `APP_BASE_URL` erfordern einen vollständigen Frontend-Rebuild/Redeploy. Der Frontend-Container vergleicht beim Start den Build-Pfad mit dem Runtime-Wert und beendet sich mit einer Fehlermeldung, falls beide voneinander abweichen.
