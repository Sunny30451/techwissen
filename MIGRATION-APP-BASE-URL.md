# APP_BASE_URL – Pfadkonvention

TechWissen verwendet ausschließlich `APP_BASE_URL` als konfigurierbaren öffentlichen Anwendungspfad.

## Format

`APP_BASE_URL` enthält **nur den Pfad**, niemals Domain oder Protokoll:

```env
APP_BASE_URL=/tech
```

Weitere gültige Beispiele:

```env
APP_BASE_URL=/techwissen
APP_BASE_URL=/apps/techwissen
```

Die Domain und HTTPS-Terminierung werden ausschließlich in Dokploy/Traefik konfiguriert.

## Fallback

Wenn `APP_BASE_URL` leer oder nicht definiert ist, ermittelt der Frontend-Build den Repository-Namen und verwendet:

```text
/<repositoryname>
```

Für das Repository `techwissen` ist der Fallback damit `/techwissen`.

## Dokploy

Bei `APP_BASE_URL=/tech`:

```text
Service: frontend
Container Port: 80
Domain: DOMAIN
Path: /tech
Strip Path: OFF
HTTPS: ON
```

Bei leerer `APP_BASE_URL` wird in Dokploy `/<repositoryname>` als Path gesetzt.

## Rebuild

Vite bettet den Pfad beim Build in die Asset-URLs ein. Jede Änderung von `APP_BASE_URL` erfordert daher einen vollständigen Frontend-Rebuild/Redeploy. Der Nginx-Entrypoint prüft zusätzlich, ob der Runtime-Pfad mit dem Build-Pfad übereinstimmt.
