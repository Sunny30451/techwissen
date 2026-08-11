# n8n mit Docker und Dokploy auf einem Contabo VPS bereitstellen

Mit **n8n** lassen sich Workflows, Integrationen und AI-Automationen visuell erstellen und selbst hosten. In dieser Anleitung stellen wir n8n in Docker auf einem Contabo-VPS bereit und deployen den Stack mit Dokploy.

Die Installation verwendet:

- n8n als Workflow- und Automationsplattform
- PostgreSQL als persistente Datenbank
- Dokploy/Traefik für HTTPS und Domain-Routing
- wahlweise einen bereits vorhandenen Ollama-Docker-Container auf demselben VPS
- oder einen externen LLM-Provider wie OpenAI, Anthropic oder Google Gemini

Für die gewünschte URL verwenden wir im Beispiel:

```text
https://example.com/n8n/
```

> **Wichtig:** n8n unterstützt einen eigenen Basispfad über `N8N_PATH`, die offizielle n8n-Dokumentation warnt jedoch davor, `N8N_PATH` zusammen mit Reverse Proxies einzusetzen, weil dies zu Navigationsproblemen führen kann. Für eine besonders robuste Produktionsinstallation ist deshalb `https://n8n.example.com/` die bevorzugte Variante. Die Pfadvariante `https://example.com/n8n/` wird in dieser Anleitung trotzdem vollständig beschrieben.

## Zielarchitektur

```text
Internet
   │
   │ HTTPS :443
   ▼
Dokploy / Traefik
   │
   │ https://example.com/n8n/
   ▼
┌──────────────────────────────┐
│ n8n                          │
│ Container-Port 5678          │
│ kein Host-Port               │
└──────────────┬───────────────┘
               │
               ├──────────────► PostgreSQL
               │                n8n-private
               │                Port 5432
               │
               ├──────────────► Ollama optional
               │                ollama-internal
               │                http://ollama:11434
               │
               └──────────────► Internet
                                OpenAI / Anthropic /
                                Gemini / APIs / OAuth
```

Nach außen wird ausschließlich n8n über Dokploy/Traefik veröffentlicht.

Nicht öffentlich erreichbar sind:

```text
PostgreSQL :5432
Ollama     :11434
```

## Warum PostgreSQL statt SQLite?

n8n verwendet bei einer einfachen Installation standardmäßig SQLite. Für einen dauerhaft betriebenen Server verwenden wir PostgreSQL, weil Datenbank und n8n-Prozess dadurch sauber getrennt sind und sich Backups, Migrationen und spätere Skalierung besser verwalten lassen.

Persistiert werden zwei Bereiche:

```text
PostgreSQL-Daten
/home/node/.n8n
```

Das n8n-Volume enthält weiterhin wichtige Instanzdaten. Die eigentlichen Workflows und Credentials liegen bei dieser Konfiguration in PostgreSQL.

## Voraussetzungen

Auf dem Contabo-VPS sollten bereits vorhanden sein:

- Ubuntu
- Docker
- Docker Compose
- Dokploy
- funktionierendes DNS für die gewünschte Domain
- HTTPS über Dokploy/Let's Encrypt
- ausreichend RAM für n8n und PostgreSQL

Optional:

- ein bereits laufender Ollama-Container
- das externe Docker-Netz `ollama-internal` aus der Ollama-Anleitung

Für diese Anleitung verwenden wir:

```text
n8n:         2.33.7
PostgreSQL:  17-alpine
n8n-Port:    5678
Zeitzone:    Europe/Berlin
App-Pfad:    /n8n/
```

Die n8n-Version ist bewusst gepinnt. Bei Updates solltest du die Versionsnummer gezielt ändern und die Release Notes prüfen.

## Repository anlegen

Lege beispielsweise ein eigenes Repository an:

```text
n8n-dokploy/
├── docker-compose.yml
├── .env.example
└── README.md
```

Das Repository enthält keine echten Passwörter oder API-Schlüssel.

## Secrets erzeugen

Wir benötigen mindestens:

```text
POSTGRES_PASSWORD
N8N_ENCRYPTION_KEY
```

Erzeuge beide Werte getrennt:

```bash
openssl rand -base64 48
```

Führe den Befehl zweimal aus und verwende zwei unterschiedliche Werte.

Der `N8N_ENCRYPTION_KEY` ist besonders wichtig. n8n verwendet ihn zur Verschlüsselung gespeicherter Credentials.

> **Den Encryption Key nach der Inbetriebnahme nicht einfach ändern oder verlieren.** Ohne den ursprünglichen Schlüssel können vorhandene verschlüsselte Credentials nicht mehr korrekt verwendet werden.

## Docker Compose erstellen

Datei:

```text
docker-compose.yml
```

Inhalt:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped

    environment:
      POSTGRES_USER: ${POSTGRES_USER:-n8n}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-n8n}

    volumes:
      - postgres-data:/var/lib/postgresql/data

    networks:
      - n8n-private

    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U ${POSTGRES_USER:-n8n} -d ${POSTGRES_DB:-n8n}"
        ]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  n8n:
    image: docker.n8n.io/n8nio/n8n:2.33.7
    restart: unless-stopped

    depends_on:
      postgres:
        condition: service_healthy

    environment:
      NODE_ENV: production

      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_PORT: 5432
      DB_POSTGRESDB_DATABASE: ${POSTGRES_DB:-n8n}
      DB_POSTGRESDB_USER: ${POSTGRES_USER:-n8n}
      DB_POSTGRESDB_PASSWORD: ${POSTGRES_PASSWORD}

      N8N_ENCRYPTION_KEY: ${N8N_ENCRYPTION_KEY}
      N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: "true"

      N8N_HOST: ${N8N_HOST}
      N8N_PORT: 5678
      N8N_PROTOCOL: https
      N8N_PATH: ${N8N_PATH:-/n8n/}
      N8N_EDITOR_BASE_URL: ${N8N_PUBLIC_URL}
      WEBHOOK_URL: ${N8N_PUBLIC_URL}
      N8N_PROXY_HOPS: 1
      N8N_SECURE_COOKIE: "true"

      GENERIC_TIMEZONE: ${GENERIC_TIMEZONE:-Europe/Berlin}
      TZ: ${GENERIC_TIMEZONE:-Europe/Berlin}

      N8N_DIAGNOSTICS_ENABLED: "false"

    expose:
      - "5678"

    volumes:
      - n8n-data:/home/node/.n8n

    networks:
      - n8n-private
      - n8n-egress

volumes:
  postgres-data:
  n8n-data:

networks:
  n8n-private:
    driver: bridge
    internal: true

  n8n-egress:
    driver: bridge
```

## Warum kein `ports:`-Mapping?

Die Compose-Datei enthält:

```yaml
expose:
  - "5678"
```

aber bewusst nicht:

```yaml
ports:
  - "5678:5678"
```

Dokploy/Traefik kann intern auf den Container-Port `5678` routen. Dafür muss der Port nicht direkt auf dem Contabo-Host veröffentlicht werden.

Damit vermeiden wir beispielsweise:

```text
http://VPS-IP:5678
```

als zusätzlichen öffentlichen Zugriffsweg.

## Netzwerkaufteilung

Wir verwenden zwei n8n-eigene Netze.

### `n8n-private`

```yaml
internal: true
```

Dieses Netz verbindet:

```text
n8n <-> PostgreSQL
```

PostgreSQL benötigt selbst keinen Internetzugang.

### `n8n-egress`

Dieses normale Bridge-Netz gibt n8n ausgehenden Internetzugriff.

Das wird benötigt für:

```text
HTTP Request Nodes
OAuth-Anmeldungen
externe APIs
Cloud-LLM-Provider
Webhooks zu Drittsystemen
Paket-/Integrationszugriffe
```

PostgreSQL wird nicht mit diesem Netz verbunden.

## `.env.example`

Lege folgende Vorlage an:

```env
POSTGRES_USER=n8n
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=n8n

N8N_ENCRYPTION_KEY=CHANGE_ME

N8N_HOST=example.com
N8N_PATH=/n8n/
N8N_PUBLIC_URL=https://example.com/n8n/

GENERIC_TIMEZONE=Europe/Berlin
```

Die Datei ist nur eine Vorlage.

Produktiv setzt du die echten Werte in Dokploy.

## Bedeutung der URL-Variablen

Für:

```text
https://example.com/n8n/
```

verwenden wir:

```env
N8N_HOST=example.com
N8N_PATH=/n8n/
N8N_PUBLIC_URL=https://example.com/n8n/
```

Daraus erhält n8n:

```text
N8N_EDITOR_BASE_URL=https://example.com/n8n/
WEBHOOK_URL=https://example.com/n8n/
```

Das ist wichtig, weil n8n hinter einem Reverse Proxy sonst unter Umständen interne Adressen oder das falsche Protokoll zur Generierung von Webhook-URLs verwendet.

Zusätzlich:

```env
N8N_PROXY_HOPS=1
```

weil sich vor n8n in dieser Architektur genau ein Reverse Proxy befindet:

```text
Traefik
```

## Deployment in Dokploy

In Dokploy:

1. Projekt erstellen oder vorhandenes Infrastrukturprojekt öffnen.
2. **Compose Service** erstellen.
3. Compose Type **Docker Compose** auswählen.
4. GitHub/Git-Repository auswählen.
5. Repository `n8n-dokploy` auswählen.
6. Compose Path auf `./docker-compose.yml` setzen.
7. Environment-Variablen eintragen.
8. Deployment starten.

Setze mindestens:

```env
POSTGRES_USER=n8n
POSTGRES_PASSWORD=DEIN_LANGES_DB_PASSWORT
POSTGRES_DB=n8n

N8N_ENCRYPTION_KEY=DEIN_LANGER_ENCRYPTION_KEY

N8N_HOST=example.com
N8N_PATH=/n8n/
N8N_PUBLIC_URL=https://example.com/n8n/

GENERIC_TIMEZONE=Europe/Berlin
```

## Domain und App-Pfad in Dokploy konfigurieren

Öffne bei der Compose-Anwendung:

```text
Domains
```

und erstelle eine Domain.

Für unser Beispiel:

| Einstellung | Wert |
| --- | --- |
| Host | `example.com` |
| Path | `/n8n` |
| Service | `n8n` |
| Container Port | `5678` |
| HTTPS | `ON` |
| Certificate | `Let's Encrypt` |
| Strip Path | `OFF` |
| Internal Path | leer |

`Strip Path` bleibt ausgeschaltet, weil n8n selbst mit:

```env
N8N_PATH=/n8n/
```

konfiguriert ist und den Pfad erhalten soll.

Nach einer Domainänderung muss eine Docker-Compose-Anwendung in Dokploy erneut deployed werden, damit Traefik die neuen Docker-Labels übernimmt.

## Warum `Strip Path` hier ausgeschaltet bleibt

Wenn Dokploy `/n8n` entfernen würde, erhielte n8n intern beispielsweise:

```text
/settings
```

obwohl die Anwendung selbst auf:

```text
/n8n/
```

konfiguriert wurde.

Das kann zu falschen Redirects und kaputten Asset-URLs führen.

Deshalb gilt in unserer Pfadvariante:

```text
Browser:  /n8n/workflow/...
Traefik:  /n8n/workflow/...
n8n:      /n8n/workflow/...
```

## Empfohlene Alternative: eigene Subdomain

Wenn du nicht zwingend einen App-Pfad benötigst, ist diese Variante robuster:

```text
https://n8n.example.com/
```

Environment:

```env
N8N_HOST=n8n.example.com
N8N_PATH=/
N8N_PUBLIC_URL=https://n8n.example.com/
```

Dokploy Domain:

```text
Host:           n8n.example.com
Path:           /
Service:        n8n
Container Port: 5678
HTTPS:          ON
Strip Path:     OFF
```

Diese Variante entspricht der Empfehlung der n8n-Dokumentation, wenn ein Reverse Proxy verwendet wird.

## Erstes Login und Owner-Account

Nach erfolgreichem Deployment öffnest du:

```text
https://example.com/n8n/
```

Beim erstmaligen Aufruf führt n8n durch die Einrichtung der Instanz und des Owner-Accounts.

Verwende produktiv:

- eine eigene Admin-E-Mail-Adresse
- ein langes, einzigartiges Passwort
- ausschließlich HTTPS

Danach solltest du dich einmal ab- und wieder anmelden und prüfen, ob die komplette Oberfläche unter dem App-Pfad funktioniert.

## Basisfunktion testen

Erstelle einen Workflow:

```text
Manual Trigger
    ↓
Edit Fields
```

Setze beispielsweise:

```json
{
  "message": "TechWissen n8n Test"
}
```

Workflow ausführen.

Wenn die Ausgabe korrekt erscheint, funktioniert die Basisinstallation.

## Webhooks unter einem App-Pfad

Ein Webhook-Node zeigt URLs an, die mit unserem öffentlichen Basispfad beginnen sollten.

Beispiel:

```text
https://example.com/n8n/webhook/...
```

Nicht korrekt wären beispielsweise:

```text
http://n8n:5678/...
```

oder:

```text
https://example.com/webhook/...
```

wenn deine Installation tatsächlich unter `/n8n/` läuft.

Wenn die URL falsch ist, prüfe insbesondere:

```text
N8N_HOST
N8N_PATH
N8N_EDITOR_BASE_URL
WEBHOOK_URL
N8N_PROXY_HOPS
Dokploy Path
Dokploy Strip Path
```

## Ollama auf demselben VPS verwenden

Wenn du die vorherige TechWissen-Ollama-Anleitung umgesetzt hast, existiert bereits:

```text
ollama-internal
```

und Ollama ist für freigegebene Container erreichbar unter:

```text
http://ollama:11434
```

n8n muss dann zusätzlich an dieses externe Docker-Netz angeschlossen werden.

Erweitere den `n8n`-Service:

```yaml
services:
  n8n:
    # ... bestehende Konfiguration ...

    networks:
      - n8n-private
      - n8n-egress
      - ollama-internal
```

und ergänze unten:

```yaml
networks:
  n8n-private:
    driver: bridge
    internal: true

  n8n-egress:
    driver: bridge

  ollama-internal:
    external: true
    name: ollama-internal
```

Das externe Netz muss bereits auf dem VPS existieren.

Prüfen:

```bash
docker network inspect ollama-internal
```

## Ollama aus n8n erreichen

Nach dem Redeploy lautet die Ollama-Basis-URL aus dem n8n-Container:

```text
http://ollama:11434
```

Nicht:

```text
http://localhost:11434
```

`localhost` im n8n-Container bezeichnet immer den n8n-Container selbst.

## Ollama Credential in n8n erstellen

In n8n:

```text
Credentials
    -> New credential
    -> Ollama
```

Als Base URL eintragen:

```text
http://ollama:11434
```

Credential speichern und testen.

Wenn die Verbindung erfolgreich ist, kann beispielsweise ein **Ollama Chat Model** in AI-Workflows verwendet werden.

## Einfachen AI-Workflow mit Ollama erstellen

Ein möglicher Workflow:

```text
Manual Trigger
      ↓
AI Agent
      │
      └── Ollama Chat Model
```

Beim Ollama Chat Model:

```text
Credential: dein Ollama Credential
Model:      z. B. llama3.2:1b
```

Das Modell muss vorher im Ollama-Container vorhanden sein.

Beispielsweise:

```bash
OLLAMA_HOST=http://127.0.0.1:11434 ollama pull llama3.2:1b
```

Danach kannst du im AI Agent beispielsweise testen:

```text
Erkläre den Unterschied zwischen Docker Compose und Docker Swarm in drei Sätzen.
```

## Ollama-Verbindung testen

Wenn das Ollama Credential nicht funktioniert, teste zunächst das Docker-Netz.

Öffne ein Terminal im n8n-Container und prüfe, falls ein HTTP-Client vorhanden ist, den Endpunkt:

```text
http://ollama:11434/api/tags
```

Alternativ auf dem VPS mit einem temporären Curl-Container:

```bash
docker run --rm \
    --network ollama-internal \
    curlimages/curl:8.21.0 \
    -s \
    http://ollama:11434/api/tags
```

Damit testest du Ollama unabhängig von n8n.

## Externen LLM-Provider verwenden

Wenn du keinen lokalen Ollama-Dienst verwenden möchtest, kann n8n stattdessen einen externen Provider nutzen.

Typische Varianten sind:

```text
OpenAI
Anthropic
Google Gemini
OpenAI-kompatible APIs
```

Für Cloud-Provider muss der n8n-Container ausgehenden Internetzugriff besitzen. Genau dafür existiert in unserer Compose-Datei:

```text
n8n-egress
```

## API-Key nicht in den Workflow schreiben

API-Schlüssel gehören in n8n **Credentials** und nicht direkt in:

```text
Code Nodes
Set/Edit Fields Nodes
Workflow-JSON
Compose-Dateien
Git-Repositories
```

Beispiel für OpenAI:

```text
Credentials
    -> New credential
    -> OpenAI
    -> API Key eintragen
```

n8n speichert Credentials verschlüsselt in seiner Datenbank. Dafür ist unser dauerhaft gesetzter:

```text
N8N_ENCRYPTION_KEY
```

entscheidend.

## AI-Workflow mit externem Provider

Beispiel:

```text
Manual Trigger
      ↓
AI Agent
      │
      └── OpenAI Chat Model
```

oder:

```text
Manual Trigger
      ↓
AI Agent
      │
      └── Anthropic Chat Model
```

Die eigentliche Workflow-Struktur kann dadurch identisch bleiben. Nur das verwendete Chat Model und Credential werden ausgetauscht.

Das ist praktisch, wenn du Workflows zunächst lokal mit Ollama entwickelst und später für bestimmte Aufgaben einen Cloud-Provider einsetzen möchtest.

## Lokales Ollama und Cloud-LLM parallel verwenden

Du musst dich nicht dauerhaft für genau eine Variante entscheiden.

Eine n8n-Instanz kann unterschiedliche Credentials und Modelle verwenden:

```text
Workflow A -> Ollama
Workflow B -> OpenAI
Workflow C -> Anthropic
Workflow D -> Gemini
```

Auch innerhalb komplexerer AI-Workflows können unterschiedliche Modelle für unterschiedliche Aufgaben eingesetzt werden.

## Sicherheitskonzept

Für diese Installation gelten folgende Regeln:

```text
n8n UI       -> öffentlich über HTTPS und Dokploy
PostgreSQL   -> kein Host-Port
Ollama       -> kein Host-Port, keine öffentliche Domain
Secrets      -> Dokploy Environment / n8n Credentials
DB-Netz      -> internal Docker Network
LLM-Zugriff  -> nur über benötigte Netze
```

### PostgreSQL nicht veröffentlichen

Es darf kein Mapping dieser Form vorhanden sein:

```yaml
ports:
  - "5432:5432"
```

### Ollama nicht veröffentlichen

Beim separaten Ollama-Stack sollte ebenfalls kein:

```yaml
ports:
  - "11434:11434"
```

vorhanden sein.

### n8n nicht direkt veröffentlichen

Auch für n8n verwenden wir kein:

```yaml
ports:
  - "5678:5678"
```

Der Zugriff erfolgt ausschließlich über Traefik.

## Telemetrie deaktivieren

Wir setzen:

```env
N8N_DIAGNOSTICS_ENABLED=false
```

Damit wird n8ns diagnostische Telemetrie deaktiviert.

Wenn du weitere n8n-Onlinedienste deaktivieren möchtest, prüfe die aktuellen Privacy- und Deployment-Optionen der von dir eingesetzten Version, bevor du zusätzliche Variablen setzt.

## Logs prüfen

In Dokploy:

```text
n8n Compose
    -> Logs
    -> Service n8n
```

und separat:

```text
Service postgres
```

Typische Fehlerquellen sind:

```text
falsches PostgreSQL-Passwort
falscher N8N_HOST
falscher N8N_PATH
falsche WEBHOOK_URL
Dokploy Strip Path aktiviert
fehlendes ollama-internal Netzwerk
falsche Ollama Base URL
```

## Containerstatus prüfen

Auf dem VPS:

```bash
docker ps
```

Für n8n möchtest du keinen veröffentlichten Host-Port wie:

```text
0.0.0.0:5678->5678/tcp
```

sehen.

Ein rein interner Eintrag:

```text
5678/tcp
```

ist dagegen unproblematisch.

## n8n Health-Endpunkt

n8n stellt Status-Endpunkte bereit, darunter:

```text
/healthz
/healthz/readiness
```

Bei einer Pfadinstallation prüfst du über den öffentlichen Pfad entsprechend beispielsweise:

```text
https://example.com/n8n/healthz
```

Ob ein bestimmter Health-Endpunkt in deiner Version und Deployment-Art für externe Überwachung geeignet ist, solltest du nach jedem Versionsupgrade kurz testen.

## Backups

Sichere mindestens:

```text
postgres-data
n8n-data
N8N_ENCRYPTION_KEY
```

Besonders kritisch ist die Kombination aus:

```text
Datenbankbackup
+
passendem N8N_ENCRYPTION_KEY
```

Ein Datenbankbackup ohne den zugehörigen Encryption Key ist für verschlüsselte Credentials nicht ausreichend.

## PostgreSQL Backup erstellen

Beispiel auf dem VPS:

```bash
docker exec \
    CONTAINER_POSTGRES \
    pg_dump \
    -U n8n \
    -d n8n \
    > n8n-backup.sql
```

Den konkreten Container-Namen findest du über:

```bash
docker ps
```

Zusätzlich kannst du Dokploys Volume-/Backupfunktionen für persistente Volumes verwenden.

## Update von n8n

Wir haben die Version bewusst fest gesetzt:

```yaml
image: docker.n8n.io/n8nio/n8n:2.33.7
```

Für ein Update:

1. PostgreSQL-Backup erstellen.
2. `N8N_ENCRYPTION_KEY` sichern.
3. n8n Release Notes lesen.
4. Image-Tag im Compose ändern.
5. In Dokploy redeployen.
6. Login testen.
7. Editor testen.
8. Webhook testen.
9. Ollama-/LLM-Credentials testen.
10. wichtige Workflows manuell ausführen.

Verwende produktiv nicht blind:

```yaml
image: docker.n8n.io/n8nio/n8n:latest
```

Ein gepinnter Tag macht Updates reproduzierbarer.

## Fehler: Oberfläche lädt, Unterseiten funktionieren nicht

Das ist bei einer Path-Installation besonders wichtig.

Prüfe:

```env
N8N_PATH=/n8n/
N8N_PUBLIC_URL=https://example.com/n8n/
```

und in Dokploy:

```text
Path:       /n8n
Strip Path: OFF
```

Wenn weiterhin Navigation, Redirects oder statische Assets fehlschlagen, wechsle auf die empfohlene Subdomain-Variante:

```text
https://n8n.example.com/
```

Das ist die zuverlässigste Lösung für Reverse-Proxy-Betrieb.

## Fehler: Webhook zeigt falsche URL

Prüfe:

```env
N8N_EDITOR_BASE_URL=https://example.com/n8n/
WEBHOOK_URL=https://example.com/n8n/
N8N_PROXY_HOPS=1
```

Danach redeployen.

## Fehler: n8n kann PostgreSQL nicht erreichen

Im n8n-Container ist der Datenbankhost:

```text
postgres
```

Nicht:

```text
localhost
```

Prüfe:

```env
DB_POSTGRESDB_HOST=postgres
DB_POSTGRESDB_PORT=5432
```

sowie die PostgreSQL-Logs.

## Fehler: n8n kann Ollama nicht erreichen

Prüfe zuerst:

```bash
docker network inspect ollama-internal
```

Der n8n-Container und der Ollama-Container müssen beide als Teilnehmer erscheinen.

Die Base URL lautet:

```text
http://ollama:11434
```

Nicht:

```text
http://localhost:11434
```

Wenn n8n und Ollama in getrennten Compose-Projekten laufen, ist das gemeinsame externe Netzwerk der entscheidende Verbindungspunkt.

## Fehler: Cloud-LLM funktioniert nicht

Prüfe:

```text
API-Key
Provider-Credential
Modellname
Account-/Billing-Status beim Provider
ausgehenden Internetzugriff des n8n-Containers
```

Die Datenbank selbst benötigt dafür keinen Internetzugang.

## Produktionscheckliste

Vor der produktiven Nutzung:

- [ ] DNS zeigt auf den Contabo-VPS
- [ ] HTTPS ist in Dokploy aktiviert
- [ ] n8n besitzt keinen öffentlichen Host-Port
- [ ] PostgreSQL besitzt keinen öffentlichen Host-Port
- [ ] `POSTGRES_PASSWORD` ist zufällig und lang
- [ ] `N8N_ENCRYPTION_KEY` ist zufällig, lang und extern gesichert
- [ ] `N8N_HOST` ist korrekt
- [ ] `N8N_PUBLIC_URL` ist korrekt
- [ ] `N8N_PROXY_HOPS=1` ist gesetzt
- [ ] bei App-Pfad: `N8N_PATH=/n8n/`
- [ ] bei App-Pfad: Dokploy `Path=/n8n`
- [ ] bei App-Pfad: `Strip Path=OFF`
- [ ] Owner-Account besitzt ein starkes Passwort
- [ ] PostgreSQL-Backup ist eingerichtet
- [ ] Ollama ist nur intern erreichbar, falls verwendet
- [ ] Provider-API-Keys liegen nur in n8n Credentials
- [ ] Webhook-URLs wurden getestet
- [ ] wichtige Workflows wurden nach dem Deployment getestet

## Empfohlene endgültige Architektur

Für eine kleine bis mittlere Self-Hosted-n8n-Installation auf einem Contabo-VPS würde ich folgende Struktur verwenden:

```text
Contabo VPS
│
├── Dokploy / Traefik
│      │
│      └── HTTPS
│           https://example.com/n8n/
│                    │
│                    ▼
├── n8n
│    ├── n8n-private ───── PostgreSQL
│    ├── n8n-egress ───── Internet / APIs / LLM Provider
│    └── ollama-internal ─ Ollama (optional)
│
├── PostgreSQL
│    └── ausschließlich internes Netz
│
└── Ollama optional
     └── ausschließlich internes ollama-internal Netz
```

Damit bleiben die Rollen klar getrennt:

```text
Dokploy  = Deployment + Reverse Proxy + TLS
n8n      = Workflow Engine + UI + AI-Orchestrierung
Postgres = persistente n8n-Daten
Ollama   = optionaler lokaler LLM-Dienst
Provider = optionaler externer LLM-Dienst
```

## Domain-Pfad oder Subdomain?

Für deine gewünschte Struktur ist möglich:

```text
https://example.com/n8n/
```

Wenn du jedoch freie Wahl hast, würde ich für n8n produktiv bevorzugen:

```text
https://n8n.example.com/
```

Der Grund ist nicht Dokploy selbst: Dokploy unterstützt Path-Routing, Internal Path und Strip Path. Der kritische Punkt ist n8n, dessen Dokumentation beim Einsatz von `N8N_PATH` hinter Reverse Proxies vor möglichen Navigationsproblemen warnt.

Die Subdomain reduziert diese Fehlerklasse vollständig und vereinfacht zusätzlich Webhooks, OAuth-Callback-URLs und Fehlersuche.

## Quellen

Diese Anleitung wurde gegen die aktuellen offiziellen Dokumentationen zum Stand August 2026 geprüft:

- n8n Dokumentation: Docker-Installation und Docker Compose
- n8n Dokumentation: Deployment-Environment-Variablen und `N8N_PATH`
- n8n Dokumentation: Webhook-URLs hinter Reverse Proxies
- n8n Dokumentation: PostgreSQL-Konfiguration
- n8n Dokumentation: eigener Encryption Key
- n8n Dokumentation: Ollama Credentials
- n8n Dokumentation: Health-/Monitoring-Endpunkte
- Dokploy Dokumentation: Domains, Path, Internal Path und Strip Path
- Dokploy Template: n8n mit PostgreSQL
- n8n GitHub Releases: stabile Version 2.33.7 vom 7. August 2026
