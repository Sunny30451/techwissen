# Migration auf APP_BASE_URL

TechWissen verwendet ab diesem Stand ausschließlich `APP_BASE_URL` für die öffentliche Anwendungsadresse.

## Vorher

Frühere Stände verwendeten getrennte Variablen für den Unterpfad bzw. die externe Basis-URL.
Diese Variablen werden nicht mehr ausgewertet.

## Jetzt

```env
APP_BASE_URL=https://example.com/techwissen
```

Der Pfad `/techwissen` wird daraus automatisch für Vite und Nginx abgeleitet.

## Ohne APP_BASE_URL

Wenn `APP_BASE_URL` leer oder nicht definiert ist, wird der Repository-Name verwendet:

```text
https://DOMAIN/<repositoryname>
```

Die Domain wird in diesem Fall ausschließlich im Dokploy-Domains-Tab festgelegt.

## Dokploy

Bei einer gesetzten URL wie:

```env
APP_BASE_URL=https://example.com/techwissen
```

muss die Domain-Konfiguration lauten:

```text
Service: frontend
Domain: example.com
Path: /techwissen
Container Port: 80
Strip Path: OFF
HTTPS: ON
```

Nach einer Änderung von `APP_BASE_URL` ist ein Rebuild/Redeploy erforderlich.
