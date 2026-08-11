# TechWissen – Dokploy Deployment mit `APP_BASE_URL`

## 1. Einzige öffentliche URL-Variable

TechWissen verwendet für die öffentliche URL ausschließlich:

```env
APP_BASE_URL=https://DOMAIN/repositoryname
```

Beispiel:

```env
APP_BASE_URL=https://example.com/techwissen
```

`APP_BASE_URL` muss, wenn gesetzt, eine vollständige `http://`- oder `https://`-URL sein. Ein abschließender Slash ist optional und wird normalisiert.

Aus dieser einen Variable werden beim Build automatisch abgeleitet:

- öffentlicher App-Pfad für Vite,
- Nginx-Prefix,
- API-Basis,
- Admin-URL,
- Artikel-URLs.

Es gibt keine separate Base-Path- oder Web-Base-URL-Variable mehr.

## 2. Fallback ohne `APP_BASE_URL`

Ist `APP_BASE_URL` in Dokploy nicht definiert oder leer, ermittelt TechWissen den Repository-Namen. Die Anwendung verwendet dann auf der in Dokploy konfigurierten Domain automatisch:

```text
https://DOMAIN/<repositoryname>
```

Bei einem Repository mit dem Namen `techwissen` lautet der Fallback-Pfad daher:

```text
/techwissen
```

Die Repository-Ermittlung verwendet zuerst das Git-Remote `origin`. Ist im Docker-Build keine Git-Metadaten verfügbar, wird der im Frontend-Paket hinterlegte Repository-Name als Fallback verwendet.

## 3. Dokploy Compose Deployment

In Dokploy ein Compose-Projekt mit folgender Datei anlegen:

```text
./docker-compose.yml
```

Die Secrets und Datenbankvariablen im Environment-Bereich von Dokploy setzen. `APP_BASE_URL` kann gesetzt oder bewusst leer gelassen werden. Dokploy schreibt Compose-Environment-Werte in die Deployment-Umgebung; im Compose werden die benötigten Werte explizit referenziert.

## 4. Domain konfigurieren

### Mit gesetzter `APP_BASE_URL`

Bei:

```env
APP_BASE_URL=https://example.com/custom-path
```

muss im Dokploy-Domains-Tab konfiguriert werden:

```text
Service:        frontend
Domain:         example.com
Path:           /custom-path
Container Port: 80
Strip Path:     OFF
HTTPS:          ON
```

### Ohne `APP_BASE_URL`

Für das Repository `techwissen`:

```text
Service:        frontend
Domain:         DOMAIN
Path:           /techwissen
Container Port: 80
Strip Path:     OFF
HTTPS:          ON
```

Der Dokploy-Pfad muss immer dem Pfadanteil der aufgelösten öffentlichen Basis-URL entsprechen. Strip Path bleibt deaktiviert, da Nginx den Prefix selbst verarbeitet.

## 5. Öffentliche Routen

Aus `APP_BASE_URL` werden automatisch erzeugt:

```text
APP_BASE_URL/
APP_BASE_URL/admin
APP_BASE_URL/artikel/<slug>
APP_BASE_URL/api/health
APP_BASE_URL/api/articles
APP_BASE_URL/api/categories
```

## 6. Netzwerk

Nur `frontend:80` wird über Dokploy/Traefik geroutet. `backend:3000` und `db:5432` bleiben im internen Compose-Netz und besitzen keine Host-Port-Freigabe.

## 7. Adminbereich

Der Adminbereich ist relativ zu `APP_BASE_URL` unter `/admin` erreichbar. Der Login verwendet `ADMIN_USERNAME` und `ADMIN_PASSWORD`. `ADMIN_SESSION_SECRET` muss dauerhaft gesetzt und bei Redeployments beibehalten werden.

## 8. Änderungen an `APP_BASE_URL`

Da Vite den öffentlichen Asset-Pfad beim Build einbettet, erfordert eine Änderung von `APP_BASE_URL` einen vollständigen Frontend-Rebuild/Redeploy. Der Nginx-Start prüft zusätzlich, ob Runtime-URL und Build-Pfad zusammenpassen, und bricht bei einer inkonsistenten Konfiguration mit einer verständlichen Fehlermeldung ab.


## 9. Artikelpakete und Upload-Volume

Der Backend-Service verwendet zusätzlich das Named Volume:

```text
article-packages
```

Es wird im Backend unter `/app/uploads` gemountet. Darin liegen die zu Artikeln hochgeladenen Dokploy-/ZIP-Pakete. Der Speicher ist **nicht öffentlich als Verzeichnis gemountet**; Downloads laufen ausschließlich über die artikelbezogene Backend-Route und den bestehenden Nginx-API-Proxy.

Optionale Uploadlimits im Dokploy-Environment:

```env
ARTICLE_PACKAGE_MAX_MB=100
ARTICLE_MARKDOWN_MAX_MB=2
```

Für ein vollständiges Backup der TechWissen-App müssen künftig mindestens gesichert werden:

- PostgreSQL / `postgres-data`
- Artikelpakete / `article-packages`

Die öffentliche Netzwerkkonvention bleibt unverändert: Nur `frontend:80` wird über Dokploy/Traefik geroutet. Für den Dateiupload ist keine zusätzliche Domain und keine zusätzliche Portfreigabe erforderlich.
