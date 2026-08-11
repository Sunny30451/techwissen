# TechWissen – Dokploy Deployment unter DOMAIN/app-base-path

## 1. Environment konfigurieren

Beispiel:

```env
APP_BASE_PATH=/app-base-path
POSTGRES_DB=techwissen
POSTGRES_USER=techwissen
POSTGRES_PASSWORD=<langes-zufälliges-passwort>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<langes-zufälliges-passwort>
ADMIN_SESSION_SECRET=<langes-zufälliges-secret>
```

Für die bisherige `/tech`-Installation:

```env
APP_BASE_PATH=/tech
```

`APP_BASE_PATH` muss mit `/` beginnen und darf am Ende keinen `/` enthalten.

## 2. Dokploy Compose Deployment

In Dokploy ein Compose-Projekt mit folgender Datei anlegen:

```text
./docker-compose.yml
```

Die oben genannten Environment-Variablen im Dokploy-Projekt setzen und anschließend deployen.

## 3. Domain konfigurieren

Im Domains-Tab:

```text
Service:        frontend
Domain:         DOMAIN
Path:           /app-base-path
Container Port: 80
Strip Path:     false
HTTPS:          true
```

Wichtig: `Path` muss exakt dem Wert von `APP_BASE_PATH` entsprechen.

## 4. Ergebnis

```text
https://DOMAIN/app-base-path/
https://DOMAIN/app-base-path/admin
https://DOMAIN/app-base-path/artikel/docker-entwicklungsumgebung-contabo-dokploy
https://DOMAIN/app-base-path/artikel/ollama-docker-dokploy-contabo-intern
https://DOMAIN/app-base-path/artikel/n8n-docker-dokploy-contabo-ollama-llm
```

Die API wird ebenfalls unter dem Base-Path bereitgestellt:

```text
https://DOMAIN/app-base-path/api/health
https://DOMAIN/app-base-path/api/articles
https://DOMAIN/app-base-path/api/categories
```

## 5. Netzwerk

Nur `frontend:80` wird von Dokploy/Traefik geroutet. `backend:3000` und `db:5432` bleiben im internen Compose-Netz und besitzen keine Host-Port-Freigabe.

## 6. Enthaltene Artikel

Beim ersten Backend-Start werden automatisch angelegt:

1. Universelle Docker-Entwicklungsumgebung auf Contabo mit Dokploy
2. Ollama sicher mit Docker und Dokploy auf einem Contabo VPS bereitstellen
3. n8n mit Docker und Dokploy auf einem Contabo VPS bereitstellen

Die separaten Upsert-Imports bleiben verfügbar:

```bash
npm run import:ollama
npm run import:n8n
```

## 7. Adminbereich

```text
https://DOMAIN/app-base-path/admin
```

Der Login verwendet `ADMIN_USERNAME` und `ADMIN_PASSWORD`. `ADMIN_SESSION_SECRET` muss dauerhaft gesetzt und bei Redeployments beibehalten werden.

## 8. Updates

Nach Änderungen an `APP_BASE_PATH` muss das Frontend neu gebaut werden, weil Vite den Basispfad in die erzeugten Assets einbettet. Ein normaler Dokploy-Rebuild/Redeploy reicht dafür aus.
