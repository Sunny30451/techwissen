# Titel der Anleitung

Diese Einleitung beschreibt in mindestens zwei Sätzen, was mit der Anleitung erreicht wird, für wen sie gedacht ist und welches Ergebnis am Ende erwartet wird. Passe diesen Text vor dem Import an das konkrete Thema an.

## Zielarchitektur

Beschreibe den gewünschten Endzustand, die beteiligten Dienste, Container, Netzwerke, Ports und den öffentlichen Zugriff. Bei TechWissen-/Dokploy-Deployments wird `APP_BASE_URL` ausschließlich als Pfad verwendet, zum Beispiel `/tech`.

## Voraussetzungen

- Benötigte Zugänge und Berechtigungen
- Unterstützte Betriebssysteme und Versionen
- Erforderliche Docker-/Dokploy-Komponenten
- Vorhandene DNS-, Domain- und Netzwerkvoraussetzungen

## Repository anlegen

Beschreibe Repository, Branch, relevante Verzeichnisse und die Dateien, die für das Deployment benötigt werden.

## Secrets erzeugen

Dokumentiere, welche Secrets benötigt werden und wie sie sicher erzeugt werden. Echte Zugangsdaten gehören niemals in den Artikel oder in das Repository.

## Docker Compose erstellen

```yaml
services:
  app:
    image: example/application:latest
    restart: unless-stopped
```

Erkläre anschließend die wichtigen Dienste, Volumes, Netzwerke und Abhängigkeiten.

## Environment-Datei

```env
APP_BASE_URL=/tech
EXAMPLE_SECRET=CHANGE_ME_BEFORE_DEPLOYMENT
```

Dokumentiere jede relevante Variable und markiere Werte, die vor dem produktiven Einsatz geändert werden müssen.

## Deployment in Dokploy

1. Projekt beziehungsweise Service in Dokploy öffnen oder anlegen.
2. Repository und Branch verbinden.
3. Environment-Variablen hinterlegen.
4. Persistente Volumes und interne Netzwerke konfigurieren.
5. Domain-Pfad auf den vorgesehenen Frontend-Port routen.
6. Für TechWissen-Subpath-Deployments `Strip Path` deaktiviert lassen.
7. Deployment starten.

## Basisfunktion testen

Beschreibe den kleinsten Funktionstest, mit dem unmittelbar geprüft werden kann, ob Anwendung, Datenbank und Routing grundsätzlich funktionieren.

## Integration mit anderen Containern

Dokumentiere interne Service-Namen, Docker-Netzwerke und die vorgesehenen internen URLs. Öffentliche Ports sollen nur verwendet werden, wenn sie tatsächlich benötigt werden.

## Deployment prüfen

Prüfe nach dem Rollout mindestens:

- Startseite beziehungsweise Hauptfunktion
- API-/Backend-Erreichbarkeit
- Subpath-Routing
- Datenbankverbindung
- Persistenz nach Container-Neustart
- benötigte interne Service-Verbindungen

## Logs prüfen

```bash
docker compose logs --tail=200
```

Beschreibe, welche Logs relevant sind und welche Fehlermeldungen typischerweise auf Routing-, Environment- oder Datenbankprobleme hinweisen.

## Healthcheck

Definiere einen reproduzierbaren Healthcheck für die zentrale Anwendung beziehungsweise API und beschreibe das erwartete Ergebnis.

## Sicherheitskonzept

- Secrets ausschließlich als geschützte Environment-Variablen verwalten.
- Datenbank- und Backend-Ports intern halten, sofern kein externer Zugriff erforderlich ist.
- Admin-Zugänge mit starken Zugangsdaten absichern.
- Uploads serverseitig nach Dateityp, Größe und Inhalt validieren.
- Backups vor risikoreichen Änderungen prüfen.

## Backups

Beschreibe zu sichernde Datenbank-, Volume- und Datei-Daten sowie Wiederherstellung und Aufbewahrung.

## Updates

Dokumentiere den sicheren Update-Ablauf einschließlich Backup, Deployment, Migrationen, Funktionstest und Rollback-Möglichkeit.

## Produktionscheckliste

- [ ] Repository und Zielbranch korrekt
- [ ] Environment-Variablen vollständig
- [ ] Secrets ersetzt und nicht im Repository gespeichert
- [ ] Persistente Volumes vorhanden
- [ ] `APP_BASE_URL` als Pfad gesetzt
- [ ] Domain-/Subpath-Routing geprüft
- [ ] `Strip Path` passend zur Anwendung konfiguriert
- [ ] Healthcheck erfolgreich
- [ ] Logs ohne kritische Fehler
- [ ] Backup und Restore-Verfahren dokumentiert

## Empfohlene endgültige Architektur

Fasse die empfohlene produktive Architektur zusammen und begründe kurz die wichtigsten Entscheidungen zu Routing, Persistenz, Sicherheit und interner Kommunikation.

## Quellen

- Offizielle Dokumentation des eingesetzten Produkts
- Offizielle Docker-Dokumentation
- Offizielle Dokploy-Dokumentation
- Weitere belastbare Primärquellen, die für die konkrete Anleitung verwendet wurden
