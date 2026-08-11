# TechWissen – aktueller Source-Stand

## Deployment-Konvention

Die Anwendung verwendet für ihre öffentliche Adresse ausschließlich `APP_BASE_URL`.

```env
APP_BASE_URL=https://DOMAIN/repositoryname
```

Wenn `APP_BASE_URL` fehlt, wird `/<repositoryname>` als öffentlicher Pfad verwendet. Die Domain stammt dann aus der Dokploy-Domain-Konfiguration.

Dokploy:

```text
Service: frontend
Container Port: 80
Path: Pfadanteil von APP_BASE_URL oder /<repositoryname>
Strip Path: OFF
HTTPS: ON
```

Backend und PostgreSQL bleiben ausschließlich im internen Compose-Netz.

## Enthalten

- React/Vite-Frontend mit Nginx
- Node.js/Express-Backend
- PostgreSQL
- Adminbereich für Artikel und Kategorien
- Markdown-Rendering und Vorschau
- Artikelimporte für Entwicklungscontainer, Ollama und n8n
- Docker-/Dokploy-Beispiele

## Artikelressourcen / Uploads

- `articles.repository_url` für optionale Repository-Verknüpfungen
- persistentes Named Volume `article-packages` für Dokploy-ZIP-Archive
- ZIP-Upload/-Austausch/-Löschung im Adminbereich
- öffentliche Paketdownloads je Artikel mit SHA-256-Metadaten
- validierter `.md`-Import für neue Artikel gemäß TechWissen-Struktur
- Uploadlimits über `ARTICLE_PACKAGE_MAX_MB` und `ARTICLE_MARKDOWN_MAX_MB`
