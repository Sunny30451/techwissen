# Hermes Agent mit Docker und Dokploy auf einem Contabo VPS bereitstellen

Hermes Agent von Nous Research ist ein selbst gehosteter AI-Agent mit persistentem Gedächtnis, Skills, Tool-Nutzung, Messaging-Gateways und optionalem Web-Dashboard. Diese Anleitung beschreibt eine produktionsnahe Bereitstellung auf einem Ubuntu-Contabo-VPS mit Docker und Dokploy.

Der Agent läuft vollständig in einem Docker-Container. Seine Konfiguration, Sessions, Skills, Erinnerungen und Zugangsdaten werden in einem persistenten Docker-Volume gespeichert. Für die Inferenz kann wahlweise ein Cloud-Provider oder ein bereits auf demselben VPS betriebenes Ollama-Dokploy-Paket verwendet werden.

Die Anleitung verwendet das offizielle Docker-Image von Nous Research und pinnt den zum Erstellungszeitpunkt aktuellen stabilen Stand `v2026.8.3`.

## Zielarchitektur

Die empfohlene Architektur trennt Agent, LLM und öffentliche Zugänge klar voneinander:

```text
Internet
   │
   │ optional HTTPS
   ▼
Dokploy / Traefik
   │
   │ optional Dashboard
   │ :9119
   ▼
┌──────────────────────────────┐
│ Hermes Agent                │
│ nousresearch/hermes-agent   │
│                              │
│ Gateway                     │
│ Dashboard optional :9119    │
│ API optional       :8642    │
│                              │
│ /opt/data                   │
└────────────┬─────────────────┘
             │
             ├──────── Internet / Cloud Provider
             │
             └──────── ollama-internal
                         │
                         ▼
                    Ollama :11434
```

Die Kernregeln lauten:

- Hermes besitzt im Basis-Deployment keine öffentliche Host-Port-Freigabe.
- `/opt/data` liegt auf einem persistenten Named Volume.
- Das Web-Dashboard ist standardmäßig deaktiviert.
- Der OpenAI-kompatible Hermes-API-Server ist standardmäßig deaktiviert.
- Cloud-Provider-Schlüssel werden ausschließlich als Dokploy-Secrets bzw. Environment-Werte hinterlegt.
- Ein lokaler Ollama-Container wird über `ollama-internal` erreicht.
- Ollama bleibt dabei weiterhin vollständig aus dem Internet abgeschottet.
- Ein öffentliches Hermes-Dashboard wird nur mit OAuth/OIDC empfohlen.

## Warum Hermes in Docker betreiben?

Das offizielle Hermes-Image ist grundsätzlich zustandslos. Der dauerhafte Zustand liegt in `/opt/data`. Dadurch lässt sich das Image aktualisieren oder der Container neu erstellen, ohne Sessions, Skills oder Konfiguration zu verlieren.

Docker passt außerdem gut zur vorhandenen Dokploy-Infrastruktur:

```text
Git Repository
     │
     ▼
Dokploy
     │
     ▼
Docker Compose
     │
     ▼
Hermes Container
     │
     ▼
Named Volume hermes-data
```

Hermes kann zwar auch direkt auf Ubuntu installiert werden, ein Container trennt Agent-Installation und Host-System jedoch deutlich sauberer.

## Voraussetzungen

Benötigt werden:

- Contabo VPS oder VDS
- Ubuntu
- Docker
- Dokploy
- Git-Repository für das Hermes-Dokploy-Paket
- ausreichend RAM für Hermes selbst
- mindestens ein LLM-Provider

Als LLM-Provider kommen beispielsweise infrage:

- OpenRouter
- Anthropic
- OpenAI
- Nous Portal
- Ollama Cloud
- lokales Ollama
- andere OpenAI-kompatible Endpunkte

Hermes benötigt mindestens einen funktionsfähigen Provider, bevor echte Agent-Sessions sinnvoll genutzt werden können.

## Ressourcen planen

Das offizielle Hermes-Docker-Image ist relativ groß und enthält eine umfangreiche Agent-Toolchain. Für den Agent-Container sollte ausreichend freier Arbeitsspeicher eingeplant werden.

Ein praktikabler Startpunkt für einen VPS ist:

```text
CPU:       2 vCPU oder mehr
RAM:       4 GB oder mehr für Hermes selbst
Storage:   mehrere GB plus persistente Agent-Daten
```

Wenn zusätzlich Ollama und ein lokales Modell auf demselben VPS laufen, bestimmen Modellgröße und Kontextfenster den eigentlichen RAM-Bedarf.

Für kleine VPS ist deshalb häufig diese Aufteilung sinnvoller:

```text
Hermes auf VPS
   │
   └── Cloud-LLM
```

statt:

```text
Hermes + großes lokales Ollama-Modell
auf demselben kleinen VPS
```

## Repository anlegen

Für Hermes empfiehlt sich ein eigenes Repository, beispielsweise:

```text
hermes-dokploy/
├── .env.example
├── docker-compose.yml
├── docker-compose.ollama.yml
├── docker-compose.ssh-dashboard.yml
├── README.md
├── examples/
│   ├── config-ollama.yaml
│   └── config-openrouter.yaml
└── scripts/
    ├── generate-secrets.sh
    ├── check-hermes.sh
    └── check-ollama.sh
```

Das zu dieser Anleitung gehörende TechWissen-Paket enthält diese Struktur bereits vollständig.

## Docker Compose erstellen

Die Basisdatei lautet:

```yaml
services:
  hermes:
    image: ${HERMES_IMAGE:-nousresearch/hermes-agent:v2026.8.3}
    restart: unless-stopped
    command: ["gateway", "run"]
    shm_size: "1gb"

    environment:
      HERMES_UID: ${HERMES_UID:-10000}
      HERMES_GID: ${HERMES_GID:-10000}

      HERMES_DASHBOARD: ${HERMES_DASHBOARD:-0}
      HERMES_DASHBOARD_HOST: ${HERMES_DASHBOARD_HOST:-0.0.0.0}
      HERMES_DASHBOARD_PORT: ${HERMES_DASHBOARD_PORT:-9119}

      HERMES_DASHBOARD_BASIC_AUTH_USERNAME: ${HERMES_DASHBOARD_BASIC_AUTH_USERNAME:-}
      HERMES_DASHBOARD_BASIC_AUTH_PASSWORD: ${HERMES_DASHBOARD_BASIC_AUTH_PASSWORD:-}
      HERMES_DASHBOARD_BASIC_AUTH_SECRET: ${HERMES_DASHBOARD_BASIC_AUTH_SECRET:-}

      HERMES_DASHBOARD_OAUTH_CLIENT_ID: ${HERMES_DASHBOARD_OAUTH_CLIENT_ID:-}
      HERMES_DASHBOARD_PUBLIC_URL: ${HERMES_DASHBOARD_PUBLIC_URL:-}

      API_SERVER_ENABLED: ${API_SERVER_ENABLED:-false}
      API_SERVER_KEY: ${API_SERVER_KEY:-}
      API_SERVER_HOST: ${API_SERVER_HOST:-0.0.0.0}
      API_SERVER_PORT: ${API_SERVER_PORT:-8642}

      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:-}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}

      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:-}
      DISCORD_BOT_TOKEN: ${DISCORD_BOT_TOKEN:-}

    volumes:
      - hermes-data:/opt/data

    networks:
      - hermes-egress

volumes:
  hermes-data:

networks:
  hermes-egress:
    driver: bridge
```

Absichtlich fehlt:

```yaml
ports:
```

Damit veröffentlicht der Basis-Container weder Dashboard noch API-Server direkt am VPS.

## Persistenz unter `/opt/data`

Hermes speichert seine dauerhaften Daten im Container unter:

```text
/opt/data
```

Dazu gehören unter anderem:

- `config.yaml`
- `.env`
- Sessions
- Skills
- Memories
- Profile
- Gateway-Logs
- Provider-Konfiguration

Das Compose-Volume lautet:

```yaml
volumes:
  - hermes-data:/opt/data
```

Dieses Volume ist Teil des Backups.

## Environment Settings in Dokploy

Als Ausgangspunkt:

```env
HERMES_IMAGE=nousresearch/hermes-agent:v2026.8.3
HERMES_UID=10000
HERMES_GID=10000

HERMES_DASHBOARD=0
HERMES_DASHBOARD_HOST=0.0.0.0
HERMES_DASHBOARD_PORT=9119

API_SERVER_ENABLED=false
API_SERVER_HOST=0.0.0.0
API_SERVER_PORT=8642
```

Provider-Secrets werden nur gesetzt, wenn sie benötigt werden:

```env
OPENROUTER_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

Diese Werte gehören in Dokploy Environment/Secrets und nicht ins Git-Repository.

## Secrets erzeugen

Für lokale Dashboard-Sessions und den optionalen API-Server lassen sich sichere Secrets erzeugen:

```bash
openssl rand -base64 48
```

und:

```bash
openssl rand -hex 32
```

Das beiliegende Skript:

```bash
./scripts/generate-secrets.sh
```

erzeugt passende Beispielwerte.

## Deployment in Dokploy

In Dokploy:

1. Projekt öffnen oder erstellen.
2. neuen Compose-Service erstellen.
3. Repository auswählen.
4. Compose Type `Docker Compose` verwenden.
5. Compose Path auf `./docker-compose.yml` setzen.
6. Environment Settings eintragen.
7. zunächst keine Domain für Hermes konfigurieren.
8. Deployment starten.

Der erste Deploy erstellt:

```text
Hermes Container
+
hermes-data Volume
```

Der Gateway-Prozess läuft im offiziellen Docker-Image unter der integrierten s6-Supervision und wird bei Prozessfehlern automatisch neu gestartet.

## Erstkonfiguration im Dokploy-Terminal

Nach dem ersten Deployment das Terminal des Hermes-Containers öffnen.

Zuerst Version prüfen:

```bash
hermes version
```

Danach die Ersteinrichtung starten:

```bash
hermes setup
```

Alternativ kann die Providerauswahl später separat geöffnet werden:

```bash
hermes model
```

Die Konfiguration wird im persistenten `/opt/data` gespeichert und bleibt daher auch nach einem Redeploy erhalten.

## Cloud-Provider einrichten

Für einen Cloud-Provider gibt es zwei übliche Varianten.

### Provider-Key über Dokploy

Beispiel OpenRouter:

```env
OPENROUTER_API_KEY=...
```

Danach im Hermes-Terminal:

```bash
hermes model
```

und OpenRouter plus gewünschtes Modell auswählen.

Dasselbe Prinzip gilt für Anthropic oder OpenAI.

### Provider über interaktiven Hermes-Setup

Bei OAuth-basierten Providern oder Nous Portal ist der interaktive Weg häufig sinnvoller:

```bash
hermes setup
```

Die dabei erzeugten Daten landen ebenfalls im persistenten Hermes-Volume.

## Vorhandenes Ollama-Dokploy-Paket verwenden

Wenn auf demselben VPS bereits das TechWissen-Ollama-Dokploy-Paket läuft, sollte Hermes dieses über das vorhandene externe Docker-Netz erreichen:

```text
ollama-internal
```

Der Hermes-Container wird nicht über die VPS-IP mit Ollama verbunden.

Stattdessen lautet die interne Adresse:

```text
http://ollama:11434
```

Für Hermes wird der OpenAI-kompatible Ollama-Endpunkt verwendet:

```text
http://ollama:11434/v1
```

## Hermes mit `ollama-internal` verbinden

Zusätzlich zur Basis-Compose-Datei wird folgende Overlay-Datei verwendet:

```yaml
services:
  hermes:
    networks:
      - hermes-egress
      - ollama-internal

networks:
  ollama-internal:
    external: true
    name: ollama-internal
```

Damit ergibt sich:

```text
Hermes
   │
   │ http://ollama:11434/v1
   ▼
ollama-internal
   │
   ▼
Ollama
```

Ollama erhält weiterhin keinen öffentlichen Port und keine Dokploy-Domain.

## Wichtige Ollama-Anforderung: 64k Kontext

Hermes verlangt für zuverlässigen Agent-Betrieb mit Tools mindestens 64.000 Tokens Kontext.

Das vorhandene Ollama-Dokploy-Paket verwendet standardmäßig möglicherweise einen kleineren Wert. Für Hermes muss in den Ollama Environment Settings deshalb mindestens gesetzt werden:

```env
OLLAMA_CONTEXT_LENGTH=64000
```

Danach Ollama neu deployen.

Dieser Wert kann den RAM-Bedarf deutlich erhöhen. Auf einem kleinen VPS ist daher ein Cloud-Modell oft die bessere Lösung.

## Ollama-Modell konfigurieren

Im Hermes-Terminal:

```bash
hermes model
```

Dann:

```text
Custom endpoint (self-hosted / VLLM / etc.)
```

wählen.

Base URL:

```text
http://ollama:11434/v1
```

API-Key:

```text
leer
```

Modell beispielsweise:

```text
qwen2.5-coder:32b
```

Die genaue Modellwahl muss zu den Ressourcen des VPS passen.

Die resultierende Konfiguration entspricht ungefähr:

```yaml
model:
  provider: custom
  default: qwen2.5-coder:32b
  base_url: http://ollama:11434/v1
  api_key: ""
  context_length: 64000
```

## Ollama-Verbindung prüfen

Im Hermes-Container:

```bash
curl -s http://ollama:11434/v1/models
```

Es sollte eine JSON-Antwort mit verfügbaren Modellen erscheinen.

Falls nicht:

```bash
docker network inspect ollama-internal
```

prüfen und sicherstellen, dass beide Container mit diesem Netz verbunden sind.

## Hermes testen

Im Dokploy-Terminal:

```bash
hermes
```

oder je nach gewünschter Oberfläche:

```bash
hermes --tui
```

Eine einfache Testaufgabe lautet beispielsweise:

```text
Erkläre kurz, welche Linux-Distribution in diesem Container läuft und verwende dafür nur ungefährliche Lese-Kommandos.
```

Damit lässt sich gleichzeitig prüfen, ob Modellzugriff und Tool-Loop funktionieren.

## Messaging Gateway verwenden

Hermes ist als dauerhaft laufender Gateway-Agent ausgelegt und unterstützt verschiedene Messaging-Plattformen.

Provider-Tokens werden als Secret gespeichert, beispielsweise:

```env
TELEGRAM_BOT_TOKEN=...
```

oder:

```env
DISCORD_BOT_TOKEN=...
```

Die jeweilige Plattform wird über Hermes eingerichtet. Für die erste Installation ist es sinnvoll, nur einen Kanal zu aktivieren und dessen Berechtigungen eng zu halten.

## Web-Dashboard

Hermes besitzt ein integriertes Dashboard auf Port:

```text
9119
```

Es zeigt unter anderem:

- Status
- Sessions
- Chat
- Skills
- Modelle
- API-Keys
- MCP-Konfiguration
- Systeminformationen

Das Dashboard kann sensible Informationen verwalten und Agent-Kommandos auslösen. Deshalb sollte es nicht ungeschützt ins Internet gestellt werden.

## Empfohlene Variante: Dashboard über SSH-Tunnel

Für eine einzelne administrative Person ist ein SSH-Tunnel die einfachste sichere Lösung.

Overlay:

```yaml
services:
  hermes:
    ports:
      - "127.0.0.1:19119:9119"
    environment:
      HERMES_DASHBOARD: "1"
      HERMES_DASHBOARD_HOST: 0.0.0.0
      HERMES_DASHBOARD_PORT: 9119
```

Der Port wird nur auf VPS-Loopback veröffentlicht:

```text
127.0.0.1:19119
```

Vom eigenen Rechner:

```bash
ssh -N -L 19119:127.0.0.1:19119 USER@VPS
```

Browser:

```text
http://127.0.0.1:19119
```

Damit ist der Dashboard-Port nicht allgemein aus dem Internet erreichbar.

## Optional: Dashboard über Dokploy öffentlich bereitstellen

Soll das Dashboard über HTTPS erreichbar sein, empfiehlt Hermes für einen internet-facing Host OAuth/OIDC statt des einfachen eingebauten Passwort-Logins.

Der sauberste Weg ist eine eigene Subdomain:

```text
https://hermes.example.com/
```

Ein App-Pfad ist ebenfalls möglich:

```text
https://example.com/hermes/
```

Bei einem App-Pfad muss der Reverse Proxy den Prefix entfernen und als `X-Forwarded-Prefix` weiterreichen.

## Dokploy Domain für einen Hermes-App-Pfad

Für:

```text
https://DOMAIN/hermes/
```

wird in Dokploy empfohlen:

```text
Service:        hermes
Container Port: 9119
Domain:         DOMAIN
Path:           /hermes
Strip Path:     ON
HTTPS:          ON
```

Warum hier `Strip Path ON`?

Hermes selbst lauscht am Root-Pfad `/`. Traefiks StripPrefix-Middleware entfernt `/hermes` vor dem Weiterleiten und setzt gleichzeitig `X-Forwarded-Prefix: /hermes`. Hermes kann diesen Header zur Rekonstruktion seiner öffentlichen Pfade verwenden.

Diese Konfiguration unterscheidet sich bewusst von TechWissen oder n8n, die ihren App-Pfad selbst kennen und deshalb mit `Strip Path OFF` betrieben werden.

## OAuth für ein öffentliches Dashboard

Vor einer öffentlichen Freigabe zuerst Hermes mit Nous Portal verbinden und das Dashboard registrieren.

Im Container:

```bash
hermes setup
```

Danach bei einer Subdomain beispielsweise:

```bash
hermes dashboard register \
  --redirect-uri https://hermes.example.com/auth/callback
```

Bei einem App-Pfad:

```bash
hermes dashboard register \
  --redirect-uri https://DOMAIN/hermes/auth/callback
```

Hermes schreibt dabei eine OAuth Client ID in seine persistente `.env`.

Für Dokploy kann zusätzlich gesetzt werden:

```env
HERMES_DASHBOARD=1
HERMES_DASHBOARD_HOST=0.0.0.0
HERMES_DASHBOARD_OAUTH_CLIENT_ID=agent:...
HERMES_DASHBOARD_PUBLIC_URL=https://DOMAIN/hermes
```

`HERMES_DASHBOARD_PUBLIC_URL` ist Hermes-spezifisch und enthält hier bewusst die vollständige öffentliche URL. Das hat nichts mit der TechWissen-Variable `APP_BASE_URL` zu tun.

## Warum Basic Auth nicht direkt öffentlich empfohlen wird

Hermes besitzt einen eingebauten Username-/Password-Provider. Dieser ist laut Hermes-Dokumentation für vertrauenswürdige Netze, VPN oder Homelab-Szenarien gedacht.

Für direkten Zugriff aus dem öffentlichen Internet fehlen dabei unter anderem:

- MFA
- individuelle Benutzerkonten
- externer Identity Provider

Deshalb gilt:

```text
SSH-Tunnel / VPN
→ Basic Auth möglich

öffentliches Internet
→ OAuth/OIDC bevorzugen
```

## Optionalen API-Server aktivieren

Hermes kann zusätzlich einen OpenAI-kompatiblen API-Server bereitstellen.

Standardmäßig bleibt er deaktiviert:

```env
API_SERVER_ENABLED=false
```

Soll er für andere interne Container verwendet werden:

```env
API_SERVER_ENABLED=true
API_SERVER_KEY=LANGES_ZUFAELLIGES_SECRET
API_SERVER_HOST=0.0.0.0
API_SERVER_PORT=8642
```

Port `8642` sollte nicht ohne Authentifizierung öffentlich freigegeben werden.

Der API-Key wird anschließend als Bearer Token verwendet.

## Keine Docker-Socket-Freigabe

Hermes kann Terminal- und Tool-Kommandos ausführen. Deshalb sollte dem Agent-Container nicht pauschal der Docker-Socket des VPS gegeben werden:

```text
/var/run/docker.sock
```

Ein Agent mit Zugriff auf diesen Socket hätte sehr weitreichende Kontrolle über den gesamten Docker-Host.

Für zusätzliche Werkzeuge sind stattdessen besser:

- dedizierte Sidecar-Container
- MCP-Server
- beschränkte APIs
- separate interne Docker-Netze

geeignet.

## Deployment prüfen

Containerstatus in Dokploy prüfen oder auf dem VPS:

```bash
docker ps
```

Hermes-Version:

```bash
docker exec <HERMES_CONTAINER> hermes version
```

Gateway-Status:

```bash
docker exec <HERMES_CONTAINER> hermes gateway status
```

Logs:

```bash
docker logs -f <HERMES_CONTAINER>
```

Hermes speichert Gateway-Logs zusätzlich persistent unter `/opt/data/logs/`.

## Dashboard-Authentifizierung prüfen

Bei aktiviertem Remote-Dashboard:

```bash
curl -s https://DOMAIN/hermes/api/status
```

Bei OAuth sollte `auth_required` aktiv sein und ein Auth-Provider angezeigt werden.

Wenn das Dashboard bei nicht-loopback Binding ohne Auth-Provider startet, stimmt die Konfiguration nicht. Aktuelle Hermes-Versionen arbeiten hier fail-closed und verweigern den Start des Dashboards.

## Sicherheitskonzept

Hermes ist kein gewöhnlicher Chatbot. Ein Agent kann je nach freigegebenen Tools Dateien lesen, Shell-Kommandos ausführen, APIs aufrufen und mit externen Diensten interagieren.

Daraus folgen zusätzliche Sicherheitsregeln.

### Agent-Berechtigungen klein halten

Nicht sofort alle möglichen Tools und Tokens freigeben.

Besser:

```text
kleiner Aufgabenbereich
→ testen
→ Logs prüfen
→ Berechtigungen gezielt erweitern
```

### Provider-Secrets nur in Dokploy

Keine echten Schlüssel in:

```text
Git
README
Dockerfile
Workflow-Beispiele
TechWissen-Artikel
```

speichern.

### Dashboard nicht ungeschützt veröffentlichen

Für ein öffentliches Dashboard OAuth/OIDC verwenden.

### API-Server nicht unnötig aktivieren

Wenn Hermes nur über Telegram oder einen anderen Gateway-Kanal genutzt wird, muss Port `8642` nicht aktiviert werden.

### Ollama intern halten

Ollama bleibt ausschließlich im Netz:

```text
ollama-internal
```

und hat weder öffentliche Domain noch Host-Port.

### Docker-Socket nicht mounten

Kein pauschaler Host-Docker-Zugriff für den Agent.

## Browser-Tools und Shared Memory

Hermes kann browserbasierte Tools verwenden. Playwright benötigt dabei ausreichend Shared Memory.

Deshalb enthält das Compose-Paket:

```yaml
shm_size: "1gb"
```

Wenn Browser-Tools abstürzen, ist dies einer der ersten Punkte, die geprüft werden sollten.

## Backup

Das wichtigste Backup-Ziel ist:

```text
hermes-data
```

Dort liegen:

- Agent-Konfiguration
- Credentials
- Skills
- Memories
- Sessions
- Profile
- persistente Logs

Da es sich um ein Docker Named Volume handelt, kann es in die Dokploy Volume-Backup-Strategie aufgenommen werden.

Vor einem größeren Update empfiehlt sich ein zusätzliches Backup dieses Volumes.

## Update

Bei gepinntem Image:

```env
HERMES_IMAGE=nousresearch/hermes-agent:v2026.8.3
```

wird ein Update bewusst durchgeführt, indem der Tag auf einen geprüften neueren Stand geändert wird.

Danach:

1. Backup prüfen.
2. Image-Tag ändern.
3. Redeploy ausführen.
4. Logs kontrollieren.
5. `hermes version` prüfen.
6. Provider und Dashboard testen.

Hermes kann beim Start Konfigurationsmigrationen durchführen und legt bei notwendigen Migrationen Sicherungskopien seiner Konfigurationsdateien an. Ein eigenes Volume-Backup bleibt trotzdem erforderlich.

## Warum nicht blind `latest` verwenden?

`latest` ist bequem, verändert aber bei jedem Pull potenziell die laufende Version.

Für reproduzierbare Deployments ist besser:

```text
nousresearch/hermes-agent:v2026.8.3
```

Nach einem kontrollierten Test kann der Tag gezielt aktualisiert werden.

## Fehler: Hermes kann Ollama nicht erreichen

Prüfen:

```bash
docker network inspect ollama-internal
```

Hermes und Ollama müssen beide Mitglied sein.

Im Hermes-Container:

```bash
curl -v http://ollama:11434/v1/models
```

Nicht verwenden:

```text
http://localhost:11434
```

Denn `localhost` im Hermes-Container bezeichnet Hermes selbst.

## Fehler: Hermes lehnt das Ollama-Kontextfenster ab

Wenn Hermes meldet, dass der Kontext zu klein ist, auf dem Ollama-Service setzen:

```env
OLLAMA_CONTEXT_LENGTH=64000
```

und Ollama neu deployen.

Danach prüfen, ob das gewählte Modell und die VPS-Ressourcen dieses Kontextfenster sinnvoll tragen können.

## Fehler: Dashboard startet nicht

Bei:

```env
HERMES_DASHBOARD=1
HERMES_DASHBOARD_HOST=0.0.0.0
```

muss ein Auth-Provider aktiv sein.

Für öffentliches Deployment:

```text
OAuth/OIDC
```

Für vertrauenswürdiges Netz oder Tunnel:

```text
Basic Auth
```

Aktuelle Hermes-Versionen verweigern einen ungeschützten Non-Loopback-Start.

## Fehler: Dashboard unter `/hermes` lädt nicht korrekt

Prüfen:

```text
Dokploy Path:       /hermes
Strip Path:         ON
Container Port:     9119
```

Außerdem:

```env
HERMES_DASHBOARD_PUBLIC_URL=https://DOMAIN/hermes
```

bei OAuth setzen.

Falls ein Reverse-Proxy-Pfad weiterhin Probleme verursacht, eine eigene Subdomain bevorzugen:

```text
https://hermes.DOMAIN/
```

Das reduziert die Komplexität von Prefix- und OAuth-Callback-Pfaden.

## Fehler: Berechtigungsfehler in `/opt/data`

Das offizielle Image verwendet standardmäßig UID/GID `10000`.

Im Paket:

```env
HERMES_UID=10000
HERMES_GID=10000
```

Bei Named Volumes ist dies normalerweise unproblematisch. Bei späteren Bind Mounts muss auf passende Dateirechte geachtet werden.

## Produktionscheckliste

Vor produktiver Nutzung prüfen:

- [ ] Hermes-Image auf einen konkreten Release-Tag gepinnt
- [ ] `hermes-data` als persistentes Named Volume vorhanden
- [ ] Backup für `hermes-data` eingerichtet
- [ ] keine Provider-Secrets im Git-Repository
- [ ] mindestens ein LLM-Provider erfolgreich getestet
- [ ] bei Ollama `OLLAMA_CONTEXT_LENGTH=64000` oder höher gesetzt
- [ ] Ollama nur über `ollama-internal` erreichbar
- [ ] kein öffentlicher Ollama-Port
- [ ] Hermes API-Server nur aktiviert, wenn benötigt
- [ ] API-Server-Key gesetzt, wenn API aktiviert
- [ ] Dashboard standardmäßig nicht öffentlich oder mit OAuth/OIDC geschützt
- [ ] für öffentlichen App-Pfad `/hermes` Strip Path ON
- [ ] `HERMES_DASHBOARD_PUBLIC_URL` bei OAuth korrekt gesetzt
- [ ] kein Docker-Socket in Hermes gemountet
- [ ] Agent-Tools und Tokens nach Least-Privilege-Prinzip vergeben
- [ ] Logs nach Deployment geprüft
- [ ] Testaufgabe erfolgreich ausgeführt

## Empfohlene endgültige Architektur

Für einen bestehenden Contabo-/Dokploy-Host mit Ollama empfehle ich:

```text
                    Internet
                       │
                       │ HTTPS optional
                       ▼
                 Dokploy / Traefik
                       │
              OAuth-geschütztes
              Dashboard optional
                       │
                       ▼
             ┌─────────────────┐
             │ Hermes Agent    │
             │                 │
             │ hermes-data     │
             └───────┬─────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
     Cloud Provider       ollama-internal
                                │
                                ▼
                           Ollama :11434
```

Für kleine VPS ist die Cloud-Provider-Variante oft ressourcenschonender. Für lokale/private Inferenz kann das vorhandene Ollama-Paket verwendet werden, sofern Modell und 64k-Kontextfenster zu RAM und CPU/GPU des Servers passen.

## Quellen

- Hermes Agent – offizielles Repository: https://github.com/NousResearch/hermes-agent
- Hermes Agent – Docker: https://hermes-agent.nousresearch.com/docs/user-guide/docker
- Hermes Agent – AI Providers: https://hermes-agent.nousresearch.com/docs/integrations/providers
- Hermes Agent – Web Dashboard: https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard
- Hermes Agent – API Server: https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server
- Hermes Agent – Environment Variables: https://hermes-agent.nousresearch.com/docs/reference/environment-variables
- Hermes Agent – Releases: https://github.com/NousResearch/hermes-agent/releases
- Docker Hub – NousResearch Hermes Agent: https://hub.docker.com/r/nousresearch/hermes-agent/tags
- Dokploy – Docker Compose: https://docs.dokploy.com/docs/core/docker-compose
- Dokploy – Utilities / Isolated Deployments: https://docs.dokploy.com/docs/core/docker-compose/utilities
- Traefik – StripPrefix: https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/stripprefix/
