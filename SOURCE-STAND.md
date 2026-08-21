# TechWissen – konsolidierter Source-Stand

Stand: 2026-08-21

Dieser Quellstand konsolidiert die aktuellsten verwertbaren Änderungen aus den GitHub-Branches `main`, `prod`, `develop`, `qa`, `test` und `Codex` sowie die im Chat erstellten TechWissen-Erweiterungen.

## Branch-Konsolidierung

- `main` bildet die technische Basis für die aktuelle `APP_BASE_URL`-Implementierung und die Artikel-Ressourcen-Funktionen.
- `develop` enthält ältere Admin-/Ollama-Arbeit; die Funktionen sind in der neueren Basis bereits enthalten.
- `qa` enthält unter anderem den Admin-Navigationslink; dieser ist im konsolidierten Frontend enthalten.
- `prod` enthält ältere Deployment-/n8n-Arbeit. Funktionsumfang wurde übernommen, aber die veraltete `APP_BASE_PATH`-Variante wurde bewusst **nicht** wieder eingeführt.
- `test` besitzt keine Änderungen, die `main` nicht bereits enthält.
- `Codex` enthält ausschließlich temporäre Payload-Dateien aus einem abgebrochenen Transfer. Diese Dateien werden nicht übernommen.
- `_tmp_payload_test`, `_tmp_payload_test2` und `_tmp_test_should_fail` zeigen exakt auf denselben Commit wie `main` und besitzen keine eigenen Änderungen; sie werden nicht als Quellen benötigt.

## Öffentlicher Anwendungspfad

TechWissen verwendet ausschließlich `APP_BASE_URL` als konfigurierbaren Pfad:

```env
APP_BASE_URL=/pfad
```

Die Domain und HTTPS werden ausschließlich in Dokploy/Traefik konfiguriert. Bei fehlender oder leerer `APP_BASE_URL` wird `/<repositoryname>` verwendet.

Dokploy:

```text
Service: frontend
Container Port: 80
Domain: gewünschte Domain
Path: APP_BASE_URL oder /<repositoryname>
Strip Path: OFF
HTTPS: ON
```

Backend `3000` und PostgreSQL `5432` bleiben intern.

## Artikelbestand

Der konsolidierte Stand enthält neun TechWissen-Artikel:

1. Docker-Entwicklungsumgebung
2. Ollama
3. n8n
4. n8n-Praxisworkflows mit Ollama
5. Hermes Agent
6. Nextcloud
7. Windows Hyper-V
8. Discord-Server
9. Hermes Agent ↔ Discord

Der zentrale Importer ist:

```text
backend/scripts/import-all-articles.js
```

Ausführung:

```bash
npm run import:all-articles
```

Artikel-ZIP-Dateien liegen im persistenten Named Volume `article-packages` und werden über die bestehende API-Route ausgeliefert.
