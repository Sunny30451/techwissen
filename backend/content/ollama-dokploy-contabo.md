# Ollama sicher mit Docker und Dokploy auf einem Contabo VPS bereitstellen

Mit **Ollama** lassen sich Large Language Models auf einem eigenen Server ausführen und über eine HTTP-API von Anwendungen ansprechen. In dieser Anleitung stellen wir Ollama als Docker-Container auf einem Contabo-VPS bereit und deployen den Dienst mit Dokploy.

Das entscheidende Sicherheitsziel lautet:

> **Ollama darf nicht aus dem Internet erreichbar sein.** Nur ausgewählte Docker-Container auf demselben Contabo-VPS dürfen über ein separates internes Docker-Netz auf die Ollama-API zugreifen.

Dafür veröffentlichen wir Port `11434` **nicht** auf dem VPS, konfigurieren **keine Dokploy-Domain** für Ollama und verwenden ein eigenes Docker-Netz `ollama-internal` für die Kommunikation zwischen Ollama und seinen Clients.

## Zielarchitektur

```text
Internet
   │
   │  kein Routing zu Ollama
   X
   │
Contabo VPS
│
├── Dokploy
│
├── Docker Network: ollama-internal
│   │
│   ├── ollama
│   │     └── HTTP API :11434
│   │
│   ├── backend-a
│   │     └── http://ollama:11434
│   │
│   └── ai-worker
│         └── http://ollama:11434
│
└── Docker Network: ollama-egress
      │
      └── ollama
            └── ausgehender Internetzugriff für Modelldownloads
```

Die Trennung ist beabsichtigt:

- `ollama-internal` verbindet ausschließlich Ollama mit freigegebenen Client-Containern.
- `ollama-egress` ermöglicht Ollama ausgehende Verbindungen, beispielsweise zum Herunterladen lokaler Modelle.
- Es existiert kein `ports:`-Mapping für `11434`.
- Für den Ollama-Service wird in Dokploy keine Domain angelegt.
- Andere Container müssen explizit an `ollama-internal` angeschlossen werden.

## Warum ein eigenes Docker-Netz?

Bei getrennten Docker-Compose-Projekten besitzt jedes Projekt normalerweise sein eigenes Netzwerk. Ein Backend aus Projekt A kann deshalb nicht automatisch einen Ollama-Container aus Projekt B über dessen Servicenamen erreichen.

Wir lösen das mit einem **externen Docker-Netzwerk**:

```text
ollama-internal
```

Dieses Netz wird einmal auf dem Contabo-Host angelegt. Danach können beliebige ausgewählte Compose-Projekte dasselbe Netz referenzieren.

Das ist besser, als Ollama pauschal an ein großes gemeinsames Anwendungsnetz anzuschließen, weil damit der Kreis der Container mit API-Zugriff kontrollierbar bleibt.

> **Sicherheitsrelevant:** Die Ollama-HTTP-API sollte wie ein interner Dienst behandelt werden. Verlasse dich nicht darauf, dass ein öffentlich erreichbarer Port allein durch einen unbekannten Endpunkt ausreichend geschützt wäre. Die wichtigste Schutzschicht in dieser Architektur ist die fehlende öffentliche Portfreigabe plus das dedizierte interne Docker-Netz.

## Voraussetzungen

Auf dem Contabo-VPS sollten bereits vorhanden sein:

- Ubuntu
- Docker
- Docker Compose
- Dokploy
- SSH-Zugriff auf den VPS oder Terminalzugriff über Dokploy
- ausreichend RAM und freier SSD-/NVMe-Speicher für die gewünschten Modelle

Für diese Anleitung verwenden wir:

```text
Ollama:      0.32.5
API-Port:    11434
Docker-Netz: ollama-internal
```

Die verwendete Ollama-Version entspricht dem Stand dieser Anleitung. Für spätere Aktualisierungen solltest du die Version bewusst ändern und anschließend testen.

## Ressourcen auf einem VPS planen

LLM-Inferenz benötigt deutlich mehr Ressourcen als ein normaler Webservice.

Wichtig sind insbesondere:

```text
CPU
RAM
Speicherplatz für Modelle
Kontextgröße
Anzahl paralleler Anfragen
Anzahl gleichzeitig geladener Modelle
```

Für einen klassischen Contabo-VPS ohne dedizierte GPU solltest du zunächst mit kleinen Modellen beginnen.

Beispiele aus der Ollama-Modellbibliothek:

| Modell | Modellgröße ungefähr | Geeignet als Einstieg |
| --- | ---: | --- |
| `gemma3:1b` | 815 MB | Ja |
| `llama3.2:1b` | 1,3 GB | Ja |
| `llama3.2` / 3B | 2,0 GB | Ja, bei ausreichend RAM |
| `gemma3:4b` | 3,3 GB | Für größere VPS |

Die Dateigröße eines Modells entspricht **nicht** dem gesamten RAM-Verbrauch. Während der Inferenz werden zusätzlich Arbeitsspeicher für Modellzustand, Kontext und parallele Requests benötigt.

Deshalb konfigurieren wir Ollama zunächst konservativ:

```text
OLLAMA_CONTEXT_LENGTH=4096
OLLAMA_NUM_PARALLEL=1
OLLAMA_MAX_LOADED_MODELS=1
```

Damit vermeiden wir, dass ein kleiner VPS durch mehrere gleichzeitig geladene Modelle oder sehr große Kontextfenster unnötig unter Speicherdruck gerät.

## Externes internes Docker-Netz erstellen

Das gemeinsame Netzwerk muss **einmalig auf dem Contabo-VPS** erstellt werden.

Per SSH:

```bash
ssh DEIN_BENUTZER@DEIN_VPS
```

Danach:

```bash
docker network create \
    --driver bridge \
    --internal \
    ollama-internal
```

Alternativ kannst du den Server-Terminalzugriff von Dokploy verwenden.

Das Flag:

```text
--internal
```

ist wichtig. Dadurch besitzt dieses Netzwerk selbst keinen externen Internetzugang.

Prüfen:

```bash
docker network inspect ollama-internal
```

In der Ausgabe sollte unter anderem stehen:

```json
"Internal": true
```

Das Netzwerk wird anschließend in mehreren Docker-Compose-Projekten als `external` eingebunden.

## Repository für Ollama

Lege beispielsweise ein eigenes Git-Repository an:

```text
ollama-dokploy/
├── docker-compose.yml
├── .env.example
└── README.md
```

Ein eigenes Repository ist sinnvoll, weil Ollama damit unabhängig von den Anwendungen aktualisiert und neu deployt werden kann, die seine API verwenden.

## Docker Compose für Ollama

Datei:

```text
docker-compose.yml
```

Inhalt:

```yaml
services:
  ollama:
    image: ollama/ollama:0.32.5
    restart: unless-stopped

    environment:
      OLLAMA_HOST: 0.0.0.0:11434
      OLLAMA_KEEP_ALIVE: ${OLLAMA_KEEP_ALIVE:-5m}
      OLLAMA_CONTEXT_LENGTH: ${OLLAMA_CONTEXT_LENGTH:-4096}
      OLLAMA_NUM_PARALLEL: ${OLLAMA_NUM_PARALLEL:-1}
      OLLAMA_MAX_LOADED_MODELS: ${OLLAMA_MAX_LOADED_MODELS:-1}

    expose:
      - "11434"

    volumes:
      - ollama-data:/root/.ollama

    networks:
      ollama-internal:
        aliases:
          - ollama
      ollama-egress:

    healthcheck:
      test:
        [
          "CMD-SHELL",
          "OLLAMA_HOST=http://127.0.0.1:11434 ollama list >/dev/null 2>&1 || exit 1"
        ]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 20s

volumes:
  ollama-data:

networks:
  ollama-internal:
    external: true
    name: ollama-internal

  ollama-egress:
    driver: bridge
```

## Warum kein `ports:`?

Die Compose-Datei enthält bewusst nur:

```yaml
expose:
  - "11434"
```

und **nicht**:

```yaml
ports:
  - "11434:11434"
```

Ein `ports:`-Mapping würde den Port auf dem Docker-Host veröffentlichen.

Mit unserer Konfiguration gilt dagegen:

```text
Internet                 -> kein Zugriff
Contabo Host :11434      -> kein veröffentlichter Port
ollama-internal Netzwerk -> Zugriff erlaubt
```

`expose` dokumentiert den internen Container-Port. Container, die im selben Docker-Netz liegen, können den Port direkt verwenden.

## Warum `OLLAMA_HOST=0.0.0.0:11434`?

Ollama verwendet seine HTTP-API auf Port `11434`. Damit Anfragen aus einem **anderen Container** angenommen werden können, muss der Prozess innerhalb des Ollama-Containers auf einer für das Container-Netz erreichbaren Adresse lauschen.

Deshalb setzen wir explizit:

```text
OLLAMA_HOST=0.0.0.0:11434
```

Das bedeutet hier **nicht**, dass Ollama automatisch im Internet erreichbar wird.

Entscheidend ist die Docker-Netzwerkschicht:

```text
OLLAMA_HOST=0.0.0.0:11434
        +
kein ports-Mapping
        +
keine Dokploy-Domain
        +
dediziertes internes Docker-Netz
```

Erst diese Kombination ergibt die gewünschte Architektur.

Das offizielle Ollama-Docker-Image setzt ebenfalls einen Listener auf `0.0.0.0:11434`; wir tragen die Variable trotzdem explizit ein, damit die Netzwerkkonfiguration im Compose nachvollziehbar bleibt.

## Persistenz der Modelle

Ollama speichert seine Docker-Daten unter:

```text
/root/.ollama
```

Deshalb verwenden wir:

```yaml
volumes:
  - ollama-data:/root/.ollama
```

Dadurch bleiben heruntergeladene Modelle bei:

```text
Container-Neustart
Redeploy
Image-Update
Container-Recreation
```

erhalten.

Ohne persistentes Volume müssten die Modelle nach einer Container-Neuerstellung erneut heruntergeladen werden.

## Environment-Datei

Optional kannst du folgende Werte in Dokploy oder in einer lokalen `.env` definieren:

```env
OLLAMA_KEEP_ALIVE=5m
OLLAMA_CONTEXT_LENGTH=4096
OLLAMA_NUM_PARALLEL=1
OLLAMA_MAX_LOADED_MODELS=1
```

### `OLLAMA_KEEP_ALIVE`

Bestimmt, wie lange ein Modell nach einer Anfrage im Arbeitsspeicher geladen bleibt.

Beispiel:

```text
5m
```

ist für einen allgemeinen Dienst ein vernünftiger Ausgangspunkt.

### `OLLAMA_CONTEXT_LENGTH`

Bestimmt die standardmäßige Kontextgröße.

```text
4096
```

ist auf einem VPS ein konservativer Startwert. Ein größeres Kontextfenster erhöht den Speicherbedarf.

### `OLLAMA_NUM_PARALLEL`

```text
1
```

begrenzt die parallele Verarbeitung pro Modell. Höhere Werte können mehr Arbeitsspeicher benötigen.

### `OLLAMA_MAX_LOADED_MODELS`

```text
1
```

verhindert auf einem kleineren Server, dass mehrere große Modelle gleichzeitig Speicher belegen.

## Optional: Ollama Cloud-Funktionen deaktivieren

Wenn du Ollama ausschließlich für lokal auf deinem VPS gespeicherte Modelle verwenden möchtest, kannst du zusätzlich setzen:

```yaml
environment:
  OLLAMA_NO_CLOUD: "1"
```

Damit werden Ollamas Cloud-Funktionen deaktiviert. Lokale Inferenz bleibt davon getrennt.

Für die reine Netzwerksicherheit dieser Anleitung ist diese Einstellung **nicht erforderlich**. Die fehlende öffentliche Erreichbarkeit wird durch Docker und Dokploy umgesetzt.

## Deployment in Dokploy

Erstelle in Dokploy ein neues Projekt oder verwende ein bestehendes Infrastrukturprojekt.

Danach:

1. **Compose Service** erstellen.
2. Compose Type **Docker Compose** auswählen.
3. Git-Provider beziehungsweise GitHub auswählen.
4. Repository `ollama-dokploy` auswählen.
5. Compose Path auf `./docker-compose.yml` setzen.
6. Environment-Variablen bei Bedarf eintragen.
7. **Keine Domain für den Ollama-Service konfigurieren.**
8. Für diese Ollama-Compose-Anwendung **Isolated Deployments deaktivieren**.
9. Deployment starten.

Warum hier keine Dokploy-Isolation?

Wir haben das Netzwerk bereits bewusst selbst definiert:

```text
ollama-internal
ollama-egress
```

Wenn keine Dokploy-Domain verwendet wird und Isolated Deployments ausgeschaltet sind, soll Dokploy die Compose-Netzwerke nicht um ein zusätzliches Routing-Netz erweitern.

Damit bleibt Ollama vollständig außerhalb des Traefik-Routings.

## Dokploy Preview Compose kontrollieren

Vor dem Deployment solltest du in Dokploy die **Preview Compose**-Ansicht prüfen.

Der Ollama-Service sollte weiterhin ungefähr diese Netzwerkstruktur besitzen:

```yaml
networks:
  - ollama-internal
  - ollama-egress
```

Es sollte insbesondere kein automatisch eingerichteter öffentlicher HTTP-Router für Ollama vorhanden sein.

Außerdem darf kein Mapping dieser Form auftauchen:

```yaml
ports:
  - "11434:11434"
```

## Deployment prüfen

Nach dem Deployment kannst du über Dokploy die Logs des Ollama-Services öffnen.

Alternativ auf dem VPS:

```bash
docker ps
```

Wichtig ist die Spalte `PORTS`.

Du möchtest **kein** Ergebnis wie dieses sehen:

```text
0.0.0.0:11434->11434/tcp
```

und auch nicht:

```text
:::11434->11434/tcp
```

Ein interner Eintrag wie:

```text
11434/tcp
```

ist dagegen unproblematisch.

Er bedeutet nicht, dass der Port auf dem Host veröffentlicht wurde.

## Von außen prüfen

Auf einem anderen Rechner sollte Folgendes fehlschlagen:

```bash
curl http://DEINE_VPS_IP:11434/api/tags
```

Erwartetes Ergebnis:

```text
keine Verbindung
```

Das ist in dieser Architektur korrekt.

Auch auf dem VPS selbst sollte:

```bash
curl http://127.0.0.1:11434/api/tags
```

nicht funktionieren, solange du bewusst **kein** localhost-Portmapping eingerichtet hast.

## Interne Erreichbarkeit testen

Da `ollama-internal` ein Docker-Netz ist, testen wir den Dienst am besten aus einem temporären Container:

```bash
docker run --rm \
    --network ollama-internal \
    curlimages/curl:8.21.0 \
    http://ollama:11434/api/tags
```

Wenn Ollama erreichbar ist, erhältst du eine JSON-Antwort.

Anfangs kann die Modellliste leer sein:

```json
{
  "models": []
}
```

Damit ist bewiesen:

```text
Container -> Ollama funktioniert
Hostport  -> nicht veröffentlicht
Internet  -> kein Zugriff
```

## Erstes Modell herunterladen

Öffne in Dokploy ein Terminal für den Ollama-Service.

Dokploy unterstützt für Docker-Compose-Anwendungen einen Terminalzugriff mit Serviceauswahl.

Für einen kleinen CPU-VPS kannst du beispielsweise mit folgendem Modell beginnen:

```bash
OLLAMA_HOST=http://127.0.0.1:11434 \
ollama pull llama3.2:1b
```

Alternativ:

```bash
OLLAMA_HOST=http://127.0.0.1:11434 \
ollama pull gemma3:1b
```

Modelle anzeigen:

```bash
OLLAMA_HOST=http://127.0.0.1:11434 \
ollama list
```

Beispiel:

```text
NAME            ID              SIZE
llama3.2:1b     ...             1.3 GB
```

## Modell interaktiv testen

Im Ollama-Container:

```bash
OLLAMA_HOST=http://127.0.0.1:11434 \
ollama run llama3.2:1b
```

Danach beispielsweise:

```text
Erkläre mir den Unterschied zwischen Docker Image und Docker Container.
```

Beenden:

```text
/bye
```

## API testen

Über einen Container im `ollama-internal`-Netz:

```bash
docker run --rm \
    --network ollama-internal \
    curlimages/curl:8.21.0 \
    -s \
    http://ollama:11434/api/chat \
    -H 'Content-Type: application/json' \
    -d '{
      "model": "llama3.2:1b",
      "messages": [
        {
          "role": "user",
          "content": "Erkläre Docker in zwei Sätzen."
        }
      ],
      "stream": false
    }'
```

Die Antwort enthält unter anderem:

```json
{
  "message": {
    "role": "assistant",
    "content": "..."
  }
}
```

## Weiteren Dokploy-Container mit Ollama verbinden

Angenommen du hast ein separates Projekt:

```text
mein-backend
```

mit folgendem Compose-Service:

```yaml
services:
  backend:
    image: ghcr.io/dein-user/mein-backend:latest
    restart: unless-stopped
```

Dann ergänzt du das gemeinsame Ollama-Netz:

```yaml
services:
  backend:
    image: ghcr.io/dein-user/mein-backend:latest
    restart: unless-stopped

    environment:
      OLLAMA_BASE_URL: http://ollama:11434

    networks:
      - default
      - ollama-internal

networks:
  ollama-internal:
    external: true
    name: ollama-internal
```

Damit besitzt das Backend zwei Netzwerkverbindungen:

```text
default beziehungsweise Dokploy-App-Netz
        -> normale Kommunikation der Anwendung

ollama-internal
        -> ausschließlich für Ollama
```

Der Ollama-Endpunkt lautet aus diesem Container:

```text
http://ollama:11434
```

Nicht:

```text
http://localhost:11434
```

Denn `localhost` bezeichnet innerhalb eines Containers immer **diesen Container selbst**.

## Client-Anwendungen mit Dokploy-Isolation

Bei normalen Webanwendungen kannst du **Isolated Deployments weiterhin aktiviert lassen**.

Der Client-Service braucht zusätzlich nur:

```yaml
networks:
  - ollama-internal
```

beziehungsweise seine bereits vorhandenen Netze plus `ollama-internal`.

Kontrolliere nach der Konfiguration über **Preview Compose**, dass der betreffende Service sowohl mit seinem Dokploy-Netz als auch mit `ollama-internal` verbunden wird.

Nur Services, die Ollama tatsächlich benötigen, sollten diesem Netzwerk hinzugefügt werden.

## Verbindung aus einem Node.js-Backend

Ein Node.js-Service kann die native `fetch`-API verwenden.

Beispiel:

```javascript
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';

const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'llama3.2:1b',
    messages: [
      {
        role: 'user',
        content: 'Erkläre PostgreSQL in drei Sätzen.',
      },
    ],
    stream: false,
  }),
});

if (!response.ok) {
  throw new Error(`Ollama antwortete mit ${response.status}`);
}

const result = await response.json();

console.log(result.message.content);
```

Compose:

```yaml
environment:
  OLLAMA_BASE_URL: http://ollama:11434
```

Damit enthält der Programmcode keine VPS-IP und keine feste Container-IP.

## Verbindung mit dem offiziellen JavaScript-Client

Ollama stellt auch eine JavaScript-Bibliothek bereit.

Installation:

```bash
npm install ollama
```

Beispiel:

```javascript
import { Ollama } from 'ollama';

const ollama = new Ollama({
  host: process.env.OLLAMA_BASE_URL || 'http://ollama:11434',
});

const response = await ollama.chat({
  model: 'llama3.2:1b',
  messages: [
    {
      role: 'user',
      content: 'Was ist ein Reverse Proxy?',
    },
  ],
});

console.log(response.message.content);
```

## Verbindung aus Python

Installation:

```bash
pip install ollama
```

Beispiel:

```python
import os
from ollama import Client

client = Client(
    host=os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
)

response = client.chat(
    model="llama3.2:1b",
    messages=[
        {
            "role": "user",
            "content": "Was ist Docker Compose?",
        }
    ],
)

print(response["message"]["content"])
```

## OpenAI-kompatible API

Wenn eine Anwendung eine OpenAI-kompatible Schnittstelle erwartet, solltest du prüfen, welche Ollama-Kompatibilitätsendpunkte und Modelloptionen die jeweilige Anwendung benötigt.

Für eigene Integrationen ist die native Ollama-API meist am transparentesten:

```text
/api/chat
/api/generate
/api/tags
/api/show
```

Die Basis-URL bleibt:

```text
http://ollama:11434
```

## Modelle verwalten

Modelle anzeigen:

```bash
OLLAMA_HOST=http://127.0.0.1:11434 ollama list
```

Neues Modell laden:

```bash
OLLAMA_HOST=http://127.0.0.1:11434 ollama pull gemma3:4b
```

Modell löschen:

```bash
OLLAMA_HOST=http://127.0.0.1:11434 ollama rm gemma3:4b
```

Aktuell geladene Modelle anzeigen:

```bash
OLLAMA_HOST=http://127.0.0.1:11434 ollama ps
```

Gerade auf einem VPS solltest du regelmäßig kontrollieren, welche Modelle tatsächlich gespeichert und geladen sind.

## Modell aus dem Arbeitsspeicher entladen

Ollama hält Modelle standardmäßig noch eine gewisse Zeit nach einer Anfrage im Speicher.

Manuell entladen:

```bash
OLLAMA_HOST=http://127.0.0.1:11434 \
ollama stop llama3.2:1b
```

Alternativ kann eine API-Anfrage mit:

```json
"keep_alive": 0
```

das Modell nach der Anfrage wieder entladen.

Wenn du wiederkehrende Anfragen erwartest, ist ein Wert wie:

```text
OLLAMA_KEEP_ALIVE=5m
```

meist effizienter, da das Modell nicht für jede Anfrage erneut geladen werden muss.

## Kontextgröße und RAM

Ollama verwendet standardmäßig eine begrenzte Kontextgröße. Größere Kontextfenster benötigen mehr Speicher.

Für einen VPS starten wir deshalb mit:

```env
OLLAMA_CONTEXT_LENGTH=4096
```

Wenn du später beispielsweise RAG, große Dokumente oder umfangreiche Chatverläufe verarbeitest, kannst du den Wert schrittweise erhöhen.

Ändere dabei immer nur eine Größe und beobachte anschließend:

```text
RAM-Auslastung
Swap
Antwortzeit
CPU-Auslastung
OOM-Kills
```

## Parallele Requests

Ein häufiger Fehler ist, auf einem kleinen VPS sofort mehrere parallele LLM-Anfragen zuzulassen.

Wir verwenden daher zunächst:

```env
OLLAMA_NUM_PARALLEL=1
```

und:

```env
OLLAMA_MAX_LOADED_MODELS=1
```

Wenn dein VPS ausreichend RAM besitzt, kannst du später höhere Werte testen.

Ollama weist darauf hin, dass parallele Verarbeitung den Speicherbedarf erhöht, insbesondere zusammen mit größeren Kontextfenstern.

## Logs prüfen

In Dokploy:

```text
Ollama Compose
    -> Logs
    -> Service: ollama
```

Alternativ auf dem Server:

```bash
docker logs --tail 200 -f CONTAINER_NAME
```

Den konkreten Container-Namen findest du über:

```bash
docker ps
```

## Healthcheck

Unsere Compose-Datei enthält:

```yaml
healthcheck:
  test:
    [
      "CMD-SHELL",
      "OLLAMA_HOST=http://127.0.0.1:11434 ollama list >/dev/null 2>&1 || exit 1"
    ]
```

Der Healthcheck prüft nicht lediglich, ob der Prozess existiert, sondern ob die Ollama-CLI die lokale Ollama-API tatsächlich ansprechen kann.

Containerstatus prüfen:

```bash
docker ps
```

Nach erfolgreichem Start sollte der Ollama-Container den Status:

```text
healthy
```

erreichen.

## Persistentes Volume sichern

Das Volume:

```text
ollama-data
```

enthält insbesondere heruntergeladene Modelldaten.

Diese Daten können sehr groß werden.

Du solltest deshalb unterscheiden zwischen:

### Reproduzierbaren Modellen

Modelle, die jederzeit erneut aus der Ollama-Bibliothek heruntergeladen werden können, müssen nicht zwingend in jedes klassische Backup aufgenommen werden.

### Eigenen Modellen und Modelfiles

Selbst importierte beziehungsweise selbst erstellte Modelle solltest du dagegen in deine Backupstrategie aufnehmen.

Wenn du Dokploy Volume Backups verwendest, berücksichtige die Größe des Volumes und den benötigten Backup-Speicher.

## Ollama aktualisieren

Wir haben das Image bewusst versioniert:

```yaml
image: ollama/ollama:0.32.5
```

Für ein Update änderst du später beispielsweise:

```yaml
image: ollama/ollama:NEUE_VERSION
```

Danach:

1. Release Notes lesen.
2. Compose-Datei committen.
3. Nach GitHub pushen.
4. In Dokploy redeployen.
5. Healthcheck und Logs prüfen.
6. `/api/tags` testen.
7. Eine echte Modellanfrage durchführen.

Das Named Volume:

```text
ollama-data
```

bleibt bei einem normalen Image-Update erhalten.

## Warum nicht einfach `latest`?

Folgendes ist bequem:

```yaml
image: ollama/ollama:latest
```

für einen dauerhaft betriebenen internen Dienst ist ein Versions-Tag aber besser nachvollziehbar.

Mit:

```yaml
image: ollama/ollama:0.32.5
```

weißt du exakt, welche Version aktuell läuft.

Updates werden dadurch zu einer bewussten Änderung statt zu einem unerwarteten Nebeneffekt eines Redeployments.

## Optional: NVIDIA-GPU

Wenn der Server tatsächlich eine unterstützte NVIDIA-GPU besitzt und der NVIDIA Container Toolkit auf dem Docker-Host korrekt eingerichtet ist, kann Ollama GPU-Beschleunigung in Docker verwenden.

Ein mögliches Compose-Muster ist:

```yaml
services:
  ollama:
    image: ollama/ollama:0.32.5

    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities:
                - gpu
```

Diese Konfiguration ist nur sinnvoll, wenn der konkrete Contabo-Server tatsächlich GPU-Passthrough für Docker bereitstellt.

Auf einem normalen CPU-VPS solltest du diesen Abschnitt weglassen.

## Kein Reverse Proxy für Ollama konfigurieren

Für unseren Anwendungsfall benötigen wir **keinen** Nginx-, Caddy- oder Traefik-Router vor Ollama.

Insbesondere solltest du in Dokploy keine Domain konfigurieren wie:

```text
ollama.example.com
```

Denn das würde den internen Dienst in Richtung Internet routbar machen.

Unsere Anwendungen verwenden stattdessen direkt:

```text
http://ollama:11434
```

innerhalb von Docker.

## Keine VPS-IP im Anwendungscode verwenden

Vermeide:

```text
http://123.123.123.123:11434
```

Selbst wenn eine Firewall den Port aktuell blockiert, wäre diese Architektur unnötig an den Host gekoppelt.

Besser:

```text
http://ollama:11434
```

Der Docker-DNS löst den Alias `ollama` im gemeinsamen Netzwerk auf.

Dadurch kannst du:

```text
Container neu erstellen
interne Container-IP ändern
Ollama aktualisieren
Client neu deployen
```

ohne die Zieladresse im Anwendungscode zu ändern.

## Fehler: Client verwendet `localhost:11434`

Symptom:

```text
Connection refused
```

Ursache:

Der Client-Container versucht Ollama auf sich selbst zu erreichen.

Falsch:

```text
http://localhost:11434
```

Richtig:

```text
http://ollama:11434
```

## Fehler: `network ollama-internal declared as external, but could not be found`

Dann wurde das externe Netzwerk auf dem VPS noch nicht erstellt.

Prüfen:

```bash
docker network ls
```

Anlegen:

```bash
docker network create \
    --driver bridge \
    --internal \
    ollama-internal
```

Danach den Dokploy-Deploy erneut starten.

## Fehler: Ollama kann kein Modell herunterladen

Prüfe zunächst die Logs.

Danach kontrollieren:

```bash
docker network inspect OLLAMA_EGRESS_NETZ
```

Der Ollama-Container muss neben `ollama-internal` auch mit einem Netzwerk verbunden sein, das ausgehenden Internetzugriff besitzt.

In unserer Compose-Datei übernimmt das:

```text
ollama-egress
```

Das interne Client-Netz selbst ist absichtlich mit `--internal` erstellt und besitzt keine externe Route.

## Fehler: Client kann `ollama` nicht auflösen

Prüfe, ob der Client wirklich mit dem gemeinsamen Netzwerk verbunden ist:

```bash
docker inspect CLIENT_CONTAINER
```

und:

```bash
docker network inspect ollama-internal
```

Beide Container müssen unter dem Netzwerk auftauchen:

```text
ollama
client
```

Test aus dem Client:

```bash
getent hosts ollama
```

oder, falls Node.js verfügbar ist:

```bash
node -e "fetch('http://ollama:11434/api/tags').then(r => r.text()).then(console.log)"
```

## Fehler: Container wird wegen Speichermangel beendet

Auf dem Host prüfen:

```bash
dmesg -T | grep -i -E 'oom|killed process'
```

Außerdem:

```bash
docker stats
```

Mögliche Maßnahmen:

1. kleineres Modell verwenden,
2. Kontextgröße reduzieren,
3. `OLLAMA_NUM_PARALLEL=1` setzen,
4. nur ein Modell gleichzeitig laden,
5. Modell nach Nutzung entladen,
6. VPS mit mehr RAM verwenden.

## Sicherheitsprüfung

Nach dem vollständigen Setup sollte folgende Matrix gelten:

| Zugriff | Ergebnis |
| --- | --- |
| Internet → `VPS-IP:11434` | Blockiert / nicht erreichbar |
| Traefik → Ollama-Domain | Keine Domain vorhanden |
| VPS `localhost:11434` | Nicht erreichbar, solange kein Host-Port gemappt ist |
| autorisierter Client → `ollama:11434` | Erreichbar |
| nicht verbundenes Compose-Projekt → `ollama:11434` | Nicht erreichbar |
| Ollama → Internet | Erreichbar über `ollama-egress` |

## Empfohlene Produktionsregeln

1. **Port `11434` niemals mit `0.0.0.0:11434:11434` veröffentlichen.**
2. **Keine Dokploy-Domain für Ollama konfigurieren**, wenn ausschließlich interne Container zugreifen sollen.
3. Ein eigenes externes Netzwerk `ollama-internal` für vertrauenswürdige Clients verwenden.
4. Dieses gemeinsame Netzwerk auf dem Host mit `--internal` erstellen.
5. Ollama zusätzlich ein separates Egress-Netz für Modelldownloads geben.
6. Nur Container an `ollama-internal` anschließen, die die API tatsächlich benötigen.
7. In Client-Anwendungen `http://ollama:11434` statt `localhost` oder der VPS-IP verwenden.
8. Modelle über ein Named Volume persistieren.
9. Ollama-Versionen bewusst pinnen und kontrolliert aktualisieren.
10. Auf CPU-VPS zunächst kleine Modelle und konservative Parallelitätswerte verwenden.
11. RAM, CPU und Modellgröße überwachen, bevor größere Kontextfenster oder parallele Requests aktiviert werden.
12. Nach jedem Netzwerk- oder Dokploy-Update erneut prüfen, dass kein öffentlicher Router beziehungsweise Host-Port für Ollama entstanden ist.

Mit dieser Architektur erhältst du einen zentralen Ollama-Dienst auf deinem Contabo-VPS, den mehrere Softwareprojekte gemeinsam verwenden können, ohne die Ollama-API ins öffentliche Internet zu stellen.

## Weiterführende offizielle Dokumentation

- [Ollama – FAQ und Serverkonfiguration](https://docs.ollama.com/faq)
- [Ollama – API Reference](https://docs.ollama.com/api)
- [Ollama – GitHub Repository](https://github.com/ollama/ollama)
- [Ollama – Releases](https://github.com/ollama/ollama/releases)
- [Ollama – Modellbibliothek](https://ollama.com/library)
- [Dokploy – Docker Compose](https://docs.dokploy.com/docs/core/docker-compose)
- [Dokploy – Isolated Deployments](https://docs.dokploy.com/docs/core/docker-compose/utilities)
- [Dokploy – Domains für Docker Compose](https://docs.dokploy.com/docs/core/docker-compose/domains)

*Stand der in diesem Artikel verwendeten Versions- und Konfigurationsbeispiele: 9. August 2026.*
