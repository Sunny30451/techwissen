# Nextcloud mit Docker und Dokploy auf einem Contabo VPS bereitstellen

Nextcloud ist eine selbst gehostete Plattform für Dateien, Synchronisation, Kalender, Kontakte, Freigaben und Zusammenarbeit. Diese Anleitung beschreibt eine produktionsnahe Bereitstellung auf einem Ubuntu-Contabo-VPS mit Docker und Dokploy.

Die Installation verwendet das offizielle Nextcloud-Docker-Image in der Apache-Variante, PostgreSQL als Datenbank, Redis für Caching und Transactional File Locking sowie einen separaten Cron-Container für Hintergrundjobs. Die öffentliche Erreichbarkeit erfolgt ausschließlich über Dokploy/Traefik und HTTPS; PostgreSQL und Redis bleiben intern.

Zum Erstellungszeitpunkt ist Nextcloud 34 die stabile Hauptversion. Das Paket pinnt deshalb `nextcloud:34.0.2-apache`, statt unkontrolliert `latest` zu verwenden.

## Zielarchitektur

Die empfohlene Architektur sieht so aus:

```text
Internet
   │
   │ HTTPS
   ▼
Dokploy / Traefik
   │
   │ DOMAIN/nextcloud
   │ oder cloud.DOMAIN
   ▼
┌───────────────────────────────┐
│ Nextcloud :80                 │
│ nextcloud:34.0.2-apache       │
│                               │
│ /var/www/html                 │
└──────────────┬────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
 PostgreSQL :5432   Redis :6379
       │
       ▼
 nextcloud-db

Cron-Container
   │
   └── gemeinsames nextcloud-html Volume
```

Die wichtigsten Regeln sind:

- Nextcloud erhält keinen direkten Host-Port.
- PostgreSQL erhält keinen öffentlichen Port.
- Redis erhält keinen öffentlichen Port.
- Nur Nextcloud-Port `80` wird intern durch Dokploy/Traefik geroutet.
- HTTPS wird in Dokploy aktiviert.
- Nextcloud-Dateien und Konfiguration liegen persistent im Named Volume `nextcloud-html`.
- PostgreSQL liegt persistent im Named Volume `nextcloud-db`.
- Redis dient als Cache und Locking-Backend und benötigt kein persistentes Backup.
- Ein separater Cron-Container führt die Nextcloud-Hintergrundjobs aus.

## Warum die Apache-Variante verwenden?

Das offizielle Nextcloud-Docker-Image bietet eine Apache- und eine FPM-Variante.

Für ein Dokploy-Deployment ist die Apache-Variante besonders einfach:

```text
Dokploy / Traefik
      │
      ▼
Nextcloud Apache :80
```

Bei FPM wäre zusätzlich ein eigener Webserver wie Nginx erforderlich.

Für diese Anleitung ist deshalb:

```text
nextcloud:34.0.2-apache
```

die pragmatische Variante.

## Nextcloud AIO oder klassisches Docker Compose?

Nextcloud bietet zusätzlich das All-in-One-Projekt an. AIO bündelt viele Komponenten und zusätzliche Nextcloud-Dienste.

Für die vorhandene Dokploy-Infrastruktur verwenden wir bewusst den klassischen Docker-Compose-Ansatz, weil dadurch:

- PostgreSQL explizit konfiguriert wird,
- Redis explizit konfiguriert wird,
- die Volumes klar sichtbar sind,
- Dokploy/Traefik die öffentliche Route kontrolliert,
- keine zusätzliche Container-Orchestrierung innerhalb eines Mastercontainers benötigt wird.

Wer später Nextcloud Office, Talk High Performance Backend oder weitere Spezialdienste benötigt, kann diese als eigene Services ergänzen.

## Voraussetzungen

Benötigt werden:

- Contabo VPS oder VDS
- Ubuntu
- Docker
- Dokploy
- eine Domain oder ein Hostname, der auf den VPS zeigt
- ausreichend freier Speicherplatz für Benutzerdateien
- ausreichend RAM für Nextcloud, PostgreSQL und Redis
- ein Git-Repository für das Dokploy-Paket

Nextcloud 34 unterstützt PostgreSQL 14 bis 18. Diese Anleitung verwendet PostgreSQL 18.

Für kleine private Installationen sollte mindestens ausreichend RAM für Webserver, PHP-Prozesse, Datenbank und Cache vorhanden sein. Der tatsächliche Bedarf hängt stark von Benutzerzahl, Apps, Vorschaubildern und Dateizugriffen ab.

## Repository-Struktur

Das zu dieser Anleitung gehörende Paket verwendet:

```text
nextcloud-dokploy-package/
├── .env.example
├── docker-compose.yml
├── README.md
│
├── examples/
│   ├── dokploy-app-path.txt
│   └── dokploy-subdomain.txt
│
└── scripts/
    ├── generate-secrets.sh
    ├── occ.sh
    └── check-nextcloud.sh
```

## Docker Compose

Die zentrale Compose-Datei lautet:

```yaml
services:
  db:
    image: ${POSTGRES_IMAGE:-postgres:18-alpine}
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-nextcloud}
      POSTGRES_USER: ${POSTGRES_USER:-nextcloud}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}
    volumes:
      - nextcloud-db:/var/lib/postgresql
    networks:
      - nextcloud-private

  redis:
    image: ${REDIS_IMAGE:-redis:8-alpine}
    restart: unless-stopped
    command: ["redis-server", "--save", "", "--appendonly", "no"]
    networks:
      - nextcloud-private

  nextcloud:
    image: ${NEXTCLOUD_IMAGE:-nextcloud:34.0.2-apache}
    restart: unless-stopped
    environment:
      POSTGRES_HOST: db
      POSTGRES_DB: ${POSTGRES_DB:-nextcloud}
      POSTGRES_USER: ${POSTGRES_USER:-nextcloud}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}

      REDIS_HOST: redis

      NEXTCLOUD_ADMIN_USER: ${NEXTCLOUD_ADMIN_USER:?NEXTCLOUD_ADMIN_USER must be set}
      NEXTCLOUD_ADMIN_PASSWORD: ${NEXTCLOUD_ADMIN_PASSWORD:?NEXTCLOUD_ADMIN_PASSWORD must be set}
      NEXTCLOUD_TRUSTED_DOMAINS: ${NEXTCLOUD_DOMAIN:?NEXTCLOUD_DOMAIN must be set}

      APACHE_DISABLE_REWRITE_IP: "1"
      TRUSTED_PROXIES: ${NEXTCLOUD_TRUSTED_PROXIES:-172.16.0.0/12}
      OVERWRITEPROTOCOL: https
      OVERWRITEWEBROOT: ${NEXTCLOUD_BASE_PATH:-/nextcloud}
      OVERWRITECLIURL: https://${NEXTCLOUD_DOMAIN:?NEXTCLOUD_DOMAIN must be set}${NEXTCLOUD_BASE_PATH:-/nextcloud}

      NEXTCLOUD_INIT_HTACCESS: "true"
      PHP_MEMORY_LIMIT: ${PHP_MEMORY_LIMIT:-1024M}
      PHP_UPLOAD_LIMIT: ${PHP_UPLOAD_LIMIT:-2G}
      APACHE_BODY_LIMIT: ${APACHE_BODY_LIMIT:-2147483648}

    volumes:
      - nextcloud-html:/var/www/html
    expose:
      - "80"
    networks:
      - nextcloud-private
      - nextcloud-egress

  cron:
    image: ${NEXTCLOUD_IMAGE:-nextcloud:34.0.2-apache}
    restart: unless-stopped
    entrypoint: /cron.sh
    environment:
      POSTGRES_HOST: db
      POSTGRES_DB: ${POSTGRES_DB:-nextcloud}
      POSTGRES_USER: ${POSTGRES_USER:-nextcloud}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}
      REDIS_HOST: redis
    volumes:
      - nextcloud-html:/var/www/html
    networks:
      - nextcloud-private
      - nextcloud-egress

volumes:
  nextcloud-html:
  nextcloud-db:

networks:
  nextcloud-private:
    driver: bridge
    internal: true
  nextcloud-egress:
    driver: bridge
```

Das vollständige Paket enthält zusätzlich Healthchecks und `depends_on`-Bedingungen.

## Persistente Daten

Das wichtigste Nextcloud-Volume ist:

```text
nextcloud-html
```

Es wird auf:

```text
/var/www/html
```

gemountet.

Dort liegen unter anderem:

- Nextcloud-Konfiguration
- Benutzerdateien
- Custom Apps
- Themes
- installierte Nextcloud-Version

PostgreSQL verwendet:

```text
nextcloud-db
```

mit dem PostgreSQL-18-Volume-Pfad:

```text
/var/lib/postgresql
```

Für ein vollständiges Backup müssen mindestens beide Volumes berücksichtigt werden.

## Redis verwenden

Redis wird nicht als Primärspeicher verwendet. Nextcloud nutzt Redis für Cache und Locking.

Das reduziert unnötige Datenbankbelastung bei Transactional File Locking.

Im Compose reicht für das offizielle Nextcloud-Image:

```env
REDIS_HOST=redis
```

Redis ist ausschließlich im internen Docker-Netz erreichbar und hat kein `ports:`-Mapping.

## Cron für Hintergrundjobs

Nextcloud benötigt regelmäßig ausgeführte Hintergrundjobs.

Deshalb existiert ein eigener Service:

```yaml
cron:
  image: nextcloud:34.0.2-apache
  entrypoint: /cron.sh
```

Wichtig ist, dass `nextcloud` und `cron` dasselbe Volume verwenden:

```yaml
- nextcloud-html:/var/www/html
```

Nach der Installation kann der Cron-Modus zusätzlich explizit gesetzt werden:

```bash
docker compose exec -u33 nextcloud php occ background:cron
```

## Environment Settings

In Dokploy werden beispielsweise gesetzt:

```env
NEXTCLOUD_IMAGE=nextcloud:34.0.2-apache
POSTGRES_IMAGE=postgres:18-alpine
REDIS_IMAGE=redis:8-alpine

NEXTCLOUD_DOMAIN=example.com
NEXTCLOUD_BASE_PATH=/nextcloud
NEXTCLOUD_TRUSTED_PROXIES=172.16.0.0/12

POSTGRES_DB=nextcloud
POSTGRES_USER=nextcloud
POSTGRES_PASSWORD=LANGES_ZUFAELLIGES_PASSWORT

NEXTCLOUD_ADMIN_USER=nextcloud-admin
NEXTCLOUD_ADMIN_PASSWORD=LANGES_ZUFAELLIGES_ADMIN_PASSWORT

PHP_MEMORY_LIMIT=1024M
PHP_UPLOAD_LIMIT=2G
APACHE_BODY_LIMIT=2147483648
```

Passwörter gehören ausschließlich in die Dokploy Environment/Secret Settings und nicht in Git.

## Secrets erzeugen

Das Paket enthält:

```bash
./scripts/generate-secrets.sh
```

Alternativ:

```bash
openssl rand -base64 48
```

Für Datenbank und Nextcloud-Admin sollten unterschiedliche Passwörter verwendet werden.

## URL-Variante 1: Nextcloud unter DOMAIN/nextcloud

Nextcloud unterstützt laut offizieller Dokumentation den Betrieb hinter einem Reverse Proxy in einem Unterverzeichnis.

Beispiel:

```text
https://example.com/nextcloud/
```

In Dokploy:

```text
Service:        nextcloud
Container Port: 80
Domain:         example.com
Path:           /nextcloud
Internal Path:  leer
Strip Path:     ON
HTTPS:          ON
```

Environment:

```env
NEXTCLOUD_DOMAIN=example.com
NEXTCLOUD_BASE_PATH=/nextcloud
```

Daraus werden im Nextcloud-Container:

```env
OVERWRITEPROTOCOL=https
OVERWRITEWEBROOT=/nextcloud
OVERWRITECLIURL=https://example.com/nextcloud
```

Warum `Strip Path ON`?

Nextcloud läuft intern im Apache-Container auf:

```text
/
```

Ein Request:

```text
https://example.com/nextcloud/login
```

wird durch Traefik intern zu:

```text
/login
```

Nextcloud weiß durch `OVERWRITEWEBROOT=/nextcloud`, dass öffentliche URLs trotzdem mit `/nextcloud` erzeugt werden müssen.

Diese Konfiguration unterscheidet sich von TechWissen, das seinen eigenen App-Pfad selbst verarbeitet und deshalb mit Strip Path OFF läuft.

## URL-Variante 2: Eigene Subdomain

Für Nextcloud ist eine eigene Subdomain in vielen Fällen einfacher:

```text
https://cloud.example.com/
```

Dokploy:

```text
Service:        nextcloud
Container Port: 80
Domain:         cloud.example.com
Path:           /
Strip Path:     OFF
HTTPS:          ON
```

Environment:

```env
NEXTCLOUD_DOMAIN=cloud.example.com
NEXTCLOUD_BASE_PATH=/
```

Diese Variante reduziert Sonderfälle bei:

- WebDAV
- CalDAV
- CardDAV
- mobilen Clients
- Desktop Sync
- Service Discovery

Wenn keine zwingende Anforderung für einen gemeinsamen Domain-Unterpfad existiert, ist die Subdomain deshalb die bevorzugte Variante.

## Trusted Proxies

Nextcloud muss wissen, welchem Reverse Proxy es vertrauen darf.

Das Compose-Paket setzt:

```env
APACHE_DISABLE_REWRITE_IP=1
TRUSTED_PROXIES=172.16.0.0/12
```

Das CIDR muss zum Docker-Netz passen, über das Dokploy/Traefik den Nextcloud-Container erreicht.

Wenn die Installation Client-IP-Adressen nicht korrekt erkennt, sollte das tatsächlich verwendete Docker-Netz geprüft werden.

Beispielsweise:

```bash
docker network ls
```

und anschließend:

```bash
docker network inspect NETZWERKNAME
```

Danach `NEXTCLOUD_TRUSTED_PROXIES` auf den tatsächlich verwendeten privaten Bereich begrenzen.

## Deployment in Dokploy

### 1. Repository erstellen

Das `nextcloud-dokploy.zip` entpacken und in ein Git-Repository übernehmen.

Beispielsweise:

```text
nextcloud-dokploy
```

### 2. Compose-Anwendung erstellen

In Dokploy:

```text
Project
→ Create Service
→ Compose
→ Docker Compose
```

Repository auswählen und als Compose-Datei:

```text
docker-compose.yml
```

verwenden.

### 3. Environment Settings setzen

Die Werte aus `.env.example` in Dokploy übernehmen und alle Beispielpasswörter ersetzen.

### 4. Deploy starten

Deployment starten und warten, bis PostgreSQL, Redis und Nextcloud healthy sind.

### 5. Domain konfigurieren

Im Tab `Domains` die gewünschte Variante konfigurieren.

Für Unterpfad:

```text
Domain:         example.com
Path:           /nextcloud
Service:        nextcloud
Container Port: 80
Strip Path:     ON
HTTPS:          ON
```

Für Subdomain:

```text
Domain:         cloud.example.com
Path:           /
Service:        nextcloud
Container Port: 80
Strip Path:     OFF
HTTPS:          ON
```

Keine zusätzlichen Host-Ports anlegen.

## Erstinstallation

Wenn Datenbank- und Admin-Variablen vollständig gesetzt sind, führt das offizielle Nextcloud-Image die Erstinstallation automatisch durch.

Danach im Browser öffnen:

```text
https://example.com/nextcloud/
```

oder:

```text
https://cloud.example.com/
```

und mit dem in Dokploy hinterlegten initialen Admin-Benutzer anmelden.

Das Admin-Passwort kann anschließend in Nextcloud geändert werden.

## OCC verwenden

Nextcloud besitzt das Administrationswerkzeug `occ`.

Im Container:

```bash
docker compose exec -u33 nextcloud php occ status
```

Komplette Systemkonfiguration anzeigen, wobei Secrets standardmäßig ausgeblendet werden:

```bash
docker compose exec -u33 nextcloud php occ config:list system
```

Das Paket enthält als Kurzform:

```bash
./scripts/occ.sh status
```

## Deployment prüfen

Container prüfen:

```bash
docker compose ps
```

Nextcloud-Status:

```bash
docker compose exec -u33 nextcloud php occ status
```

Erwartet wird unter anderem:

```text
installed: true
maintenance: false
```

Redis prüfen:

```bash
docker compose exec redis redis-cli ping
```

Antwort:

```text
PONG
```

PostgreSQL prüfen:

```bash
docker compose exec db pg_isready -U nextcloud -d nextcloud
```

Zusätzlich ist im Paket enthalten:

```bash
./scripts/check-nextcloud.sh
```

## Hintergrundjobs prüfen

In Nextcloud unter den Administrationseinstellungen sollte als Hintergrundjob `Cron` verwendet werden.

Per CLI:

```bash
docker compose exec -u33 nextcloud php occ background:cron
```

Der separate `cron`-Container führt anschließend regelmäßig `/cron.sh` aus.

## Upload-Größe

Das Paket setzt standardmäßig:

```env
PHP_UPLOAD_LIMIT=2G
APACHE_BODY_LIMIT=2147483648
```

Für größere Dateien können diese Werte erhöht werden.

Dabei müssen immer ausreichend:

- VPS-Speicher
- Backup-Speicher
- temporärer Speicher
- Netzwerkbandbreite

vorhanden sein.

## CalDAV und CardDAV bei Unterpfad

Nextcloud weist darauf hin, dass die `/.well-known/caldav`- und `/.well-known/carddav`-Weiterleitungen hinter einem Reverse Proxy vom Proxy bereitgestellt werden sollten.

Bei einer Installation unter:

```text
https://example.com/nextcloud/
```

liegen die Discovery-URLs jedoch am Domain-Root:

```text
https://example.com/.well-known/caldav
https://example.com/.well-known/carddav
```

Wenn auf derselben Domain mehrere Anwendungen über Unterpfade betrieben werden, muss die Reverse-Proxy-Konfiguration diese Redirects gezielt zu Nextcloud weiterleiten.

Für maximale Client-Kompatibilität ist deshalb eine eigene Subdomain oft einfacher:

```text
https://cloud.example.com/
```

## SMTP konfigurieren

Nextcloud kann Benachrichtigungen und Freigabe-E-Mails über einen SMTP-Server senden.

Das offizielle Docker-Image unterstützt entsprechende Environment-Variablen, beispielsweise:

```env
SMTP_HOST=smtp.example.com
SMTP_SECURE=tls
SMTP_PORT=587
SMTP_NAME=nextcloud@example.com
SMTP_PASSWORD=SMTP_SECRET
MAIL_FROM_ADDRESS=nextcloud
MAIL_DOMAIN=example.com
```

Diese Werte sollten nur dann im Compose ergänzt werden, wenn SMTP bewusst über Environment verwaltet werden soll.

Alternativ kann SMTP später über die Nextcloud-Administration eingerichtet werden.

Nicht beide Varianten parallel pflegen, da Environment-Werte die Web-Konfiguration überschreiben können.

## Sicherheitskonzept

### Keine öffentlichen Datenbankports

Nicht verwenden:

```yaml
ports:
  - "5432:5432"
```

PostgreSQL ist ausschließlich über:

```text
db:5432
```

innerhalb des Compose-Netzes erreichbar.

### Redis intern halten

Redis ist ausschließlich über:

```text
redis:6379
```

für Nextcloud erreichbar.

Kein öffentlicher Host-Port.

### Nextcloud nur über HTTPS

Öffentlicher Zugriff erfolgt ausschließlich über Dokploy/Traefik mit HTTPS.

### Admin-Passwort nicht committen

Nicht in Git speichern:

```text
POSTGRES_PASSWORD
NEXTCLOUD_ADMIN_PASSWORD
SMTP_PASSWORD
```

### Apps bewusst installieren

Jede zusätzliche Nextcloud-App erweitert die Angriffsfläche. Nur benötigte Apps installieren und regelmäßig aktualisieren.

### Trusted Proxies begrenzen

`TRUSTED_PROXIES` sollte auf das tatsächlich verwendete Docker-/Traefik-Netz begrenzt werden und nicht pauschal beliebige Internetadressen enthalten.

## Backup

Ein vollständiges Nextcloud-Backup benötigt mindestens:

```text
nextcloud-html
nextcloud-db
```

Vor einem konsistenten Backup empfiehlt sich Maintenance Mode:

```bash
docker compose exec -u33 nextcloud php occ maintenance:mode --on
```

Danach:

1. PostgreSQL sichern.
2. `nextcloud-html` sichern.
3. Maintenance Mode wieder deaktivieren.

```bash
docker compose exec -u33 nextcloud php occ maintenance:mode --off
```

Redis muss nicht gesichert werden.

Backups sollten regelmäßig außerhalb des VPS gespeichert und Wiederherstellungen getestet werden.

## Update

Der Image-Tag ist bewusst gepinnt:

```env
NEXTCLOUD_IMAGE=nextcloud:34.0.2-apache
```

Für ein Update:

1. Release Notes prüfen.
2. Backup erstellen.
3. Maintenance Mode aktivieren, wenn für das Update sinnvoll.
4. Image-Tag auf eine unterstützte neue Version ändern.
5. Redeploy durchführen.
6. Logs prüfen.
7. `occ status` prüfen.
8. Admin-Warnungen prüfen.
9. Apps aktualisieren.

Major-Versionen sollten nicht übersprungen werden.

Das offizielle Docker-Image erkennt beim Start Versionsunterschiede zwischen Image und persistentem Volume und führt die notwendigen Update-Schritte aus.

## Logs

Nextcloud-Container:

```bash
docker compose logs -f nextcloud
```

Cron:

```bash
docker compose logs -f cron
```

PostgreSQL:

```bash
docker compose logs -f db
```

Redis:

```bash
docker compose logs -f redis
```

## Fehler: Trusted Domain

Fehlermeldung:

```text
Access through untrusted domain
```

Prüfen:

```env
NEXTCLOUD_TRUSTED_DOMAINS=example.com
```

und:

```bash
docker compose exec -u33 nextcloud php occ config:list system
```

## Fehler: Falsche HTTP-Links hinter HTTPS

Prüfen:

```env
OVERWRITEPROTOCOL=https
```

Das Compose-Paket setzt diesen Wert automatisch.

## Fehler: Links verlieren /nextcloud

Bei Unterpfad prüfen:

```env
NEXTCLOUD_BASE_PATH=/nextcloud
```

und Dokploy:

```text
Path:       /nextcloud
Strip Path: ON
```

Nextcloud muss außerdem `OVERWRITEWEBROOT=/nextcloud` verwenden.

## Fehler: 404 unter /nextcloud

Wenn Dokploy `Strip Path OFF` verwendet, erreicht der Apache-Container Requests wie:

```text
/nextcloud/login
```

obwohl Nextcloud intern auf `/login` lauscht.

Für diese Architektur deshalb:

```text
Strip Path: ON
```

## Fehler: Client-IP ist die Traefik-IP

Prüfe das tatsächliche Docker-Netz und passe:

```env
NEXTCLOUD_TRUSTED_PROXIES=...
```

an.

Danach Redeploy und erneut prüfen.

## Produktionscheckliste

Vor der produktiven Nutzung prüfen:

- [ ] Nextcloud ist ausschließlich über HTTPS erreichbar.
- [ ] Kein Host-Port für PostgreSQL veröffentlicht.
- [ ] Kein Host-Port für Redis veröffentlicht.
- [ ] Kein direkter Nextcloud-Host-Port veröffentlicht.
- [ ] Datenbankpasswort ist lang und zufällig.
- [ ] Admin-Passwort ist lang und einzigartig.
- [ ] `NEXTCLOUD_TRUSTED_DOMAINS` ist korrekt.
- [ ] `TRUSTED_PROXIES` ist auf das Dokploy-/Traefik-Netz begrenzt.
- [ ] Cron-Hintergrundjobs sind aktiv.
- [ ] Redis ist aktiv.
- [ ] Backup von `nextcloud-html` existiert.
- [ ] PostgreSQL-Backup existiert.
- [ ] Restore-Prozess wurde dokumentiert.
- [ ] Nextcloud-Adminseite zeigt keine kritischen Warnungen.
- [ ] Upload-Limits passen zum verfügbaren Speicher.
- [ ] SMTP ist bei Bedarf getestet.
- [ ] Bei Unterpfad sind CalDAV/CardDAV-Clients getestet.

## Endgültige Architektur

Für eine Unterpfad-Installation:

```text
https://DOMAIN/nextcloud/
          │
          ▼
    Dokploy / Traefik
    Path /nextcloud
    Strip Path ON
          │
          ▼
    Nextcloud :80
          │
     ┌────┴─────┐
     ▼          ▼
PostgreSQL     Redis

Cron ──────────► nextcloud-html
```

Für die einfachere Subdomain-Variante:

```text
https://cloud.DOMAIN/
          │
          ▼
    Dokploy / Traefik
    Path /
    Strip Path OFF
          │
          ▼
    Nextcloud :80
```

Für die meisten Installationen ist die Subdomain die unkompliziertere Variante. Wenn die vorhandene Domain bewusst mehrere Anwendungen über Pfade bündelt, kann Nextcloud mit `OVERWRITEWEBROOT` und Dokploy `Strip Path ON` trotzdem sauber unter `/nextcloud` betrieben werden.

## Quellen

- Nextcloud Docker Image: https://github.com/nextcloud/docker
- Nextcloud Docker Hub: https://hub.docker.com/_/nextcloud
- Nextcloud Reverse Proxy: https://docs.nextcloud.com/server/stable/admin_manual/configuration_server/reverse_proxy_configuration.html
- Nextcloud System Requirements: https://docs.nextcloud.com/server/stable/admin_manual/installation/system_requirements.html
- Nextcloud Server Tuning: https://docs.nextcloud.com/server/stable/admin_manual/installation/server_tuning.html
- Nextcloud Memory Caching: https://docs.nextcloud.com/server/stable/admin_manual/configuration_server/caching_configuration.html
- Dokploy Domains: https://docs.dokploy.com/docs/core/domains
- Dokploy Docker Compose: https://docs.dokploy.com/docs/core/docker-compose
