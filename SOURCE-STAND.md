# TechWissen – Source-Stand

## Öffentlicher Anwendungspfad

TechWissen verwendet ausschließlich `APP_BASE_URL` als konfigurierbaren Pfad:

```env
APP_BASE_URL=/pfad
```

Die Domain wird ausschließlich in Dokploy konfiguriert. Bei fehlender bzw. leerer `APP_BASE_URL` wird `/<repositoryname>` verwendet.

Dokploy:

```text
Service: frontend
Container Port: 80
Domain: gewünschte Domain
Path: APP_BASE_URL oder /<repositoryname>
Strip Path: OFF
HTTPS: ON
```

Backend `3000` und PostgreSQL `5432` bleiben intern. Artikel-ZIP-Dateien liegen im persistenten Named Volume `article-packages` und werden über die bestehende API-Route ausgeliefert.
