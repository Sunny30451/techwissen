# Migration: Repository-URL, Dokploy-Pakete und Markdown-Import

Diese Version erweitert TechWissen um Artikelressourcen und Datei-Uploads.

## Datenbankschema

`backend/src/migrate.js` ergänzt bestehende Datenbanken beim Start automatisch um folgende nullable Felder in `articles`:

```text
repository_url
package_original_name
package_storage_name
package_mime_type
package_size_bytes
package_sha256
package_uploaded_at
```

Es ist kein manueller SQL-Schritt erforderlich. Die vorhandenen Artikel bleiben unverändert; neue Felder sind dort zunächst `NULL`.

## Persistenter Dateispeicher

Das Produktions-Compose enthält zusätzlich:

```yaml
volumes:
  article-packages:
```

Der Backend-Service mountet dieses Volume unter `/app/uploads` und verwendet intern `/app/uploads/article-packages`.

Wichtig: Bei Backups müssen künftig **PostgreSQL und `article-packages`** gesichert werden. Nur ein Datenbankbackup enthält die ZIP-Archive nicht.

## Uploadlimits

```env
ARTICLE_PACKAGE_MAX_MB=100
ARTICLE_MARKDOWN_MAX_MB=2
```

Nginx erlaubt passend dazu Requests bis 105 MB. Wer `ARTICLE_PACKAGE_MAX_MB` über 100 erhöht, muss `client_max_body_size` in `frontend/nginx.conf` ebenfalls entsprechend anheben.

## Deployment

Die `APP_BASE_URL`-Konvention bleibt unverändert. In Dokploy wird weiterhin ausschließlich `frontend:80` über Domain + Pfad veröffentlicht; Backend und PostgreSQL erhalten keine Host-Port-Freigabe.

Nach dem Update genügt ein vollständiger Rebuild/Redeploy. Beim Backend-Start führt `migrateAndSeed()` die additive Schemaerweiterung aus.
