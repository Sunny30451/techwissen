# n8n praktisch nutzen: Alltagsautomationen mit Ollama im Docker-/Dokploy-Setup

Diese Anleitung baut auf einer selbst gehosteten n8n-Instanz auf einem Contabo-VPS auf, die per Dokploy betrieben wird und über das interne Docker-Netz `ollama-internal` auf das Ollama-Dokploy-Paket zugreift. Ziel ist nicht ein abstrakter Überblick, sondern eine kleine Sammlung direkt nutzbarer Workflows, die sich mit wenigen Änderungen an den eigenen Alltag, private Abläufe oder Serveradministration anpassen lassen.

Die Beispiele verwenden bewusst den normalen **HTTP Request Node** von n8n und die lokale Ollama-API. Dadurch benötigen die Beispiel-Workflows keine eingebetteten Ollama-Credentials und bleiben einfach portierbar. Ollama ist innerhalb des freigegebenen Docker-Netzes unter `http://ollama:11434` erreichbar.

## Zielarchitektur

```text
Internet
   │
   │ HTTPS
   ▼
Dokploy / Traefik
   │
   │ DOMAIN/n8n/
   ▼
┌──────────────────────────────┐
│ n8n                          │
│                              │
│ Webhook / Schedule / Nodes   │
└──────────────┬───────────────┘
               │
               │ ollama-internal
               ▼
┌──────────────────────────────┐
│ Ollama                       │
│ http://ollama:11434          │
│ keine öffentliche Domain     │
│ kein Host-Port 11434         │
└──────────────────────────────┘
```

Die Trennung bleibt damit erhalten:

```text
Dokploy/Traefik = öffentlicher HTTPS-Zugang zu n8n
n8n             = Workflow-Orchestrierung
Ollama          = interner LLM-Dienst
PostgreSQL      = persistente n8n-Daten
```

Ollama wird weiterhin **nicht** aus dem Internet veröffentlicht. n8n ist lediglich einer der explizit an `ollama-internal` angeschlossenen Clients.

## Voraussetzungen

Du benötigst:

- Contabo VPS mit Ubuntu, Docker und Dokploy
- eine laufende n8n-Installation
- HTTPS-Zugriff auf n8n
- das Ollama-Dokploy-Paket auf demselben VPS
- das externe Docker-Netz `ollama-internal`
- mindestens ein in Ollama verfügbares Modell
- einen n8n-API-Key zum automatischen Import der Beispiele
- Python 3 auf dem Rechner, von dem das Installationsskript ausgeführt wird

Die bestehende n8n-Compose-Anwendung muss mit `ollama-internal` verbunden sein:

```yaml
services:
  n8n:
    networks:
      - n8n-private
      - n8n-egress
      - ollama-internal

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

Die Ollama-Adresse aus Sicht des n8n-Containers lautet:

```text
http://ollama:11434
```

Nicht:

```text
http://localhost:11434
```

`localhost` würde innerhalb des n8n-Containers auf n8n selbst zeigen.

## Repository-Aufbau des Beispielpakets

Das zu dieser Anleitung gehörende ZIP enthält:

```text
n8n-praxis-workflows/
├── README.md
├── workflows/
│   ├── 00-ollama-healthcheck.json
│   ├── 01-notizen-zusammenfassen.json
│   ├── 02-email-antwort-entwurf.json
│   ├── 03-aufgaben-priorisieren.json
│   ├── 04-wochenplan-erstellen.json
│   └── 05-server-log-analysieren.json
└── scripts/
    ├── install-workflows.py
    ├── install-workflows.sh
    ├── check-ollama-from-n8n.sh
    └── test-webhooks.sh
```

Die Workflow-Dateien enthalten keine n8n-API-Keys und keine Ollama-Cloud-API-Keys.

## n8n API-Key erstellen

Öffne in n8n:

```text
Settings
→ n8n API
→ Create an API key
```

Verwende für den Import einen eigenen Schlüssel und gib ihm eine nachvollziehbare Bezeichnung, zum Beispiel:

```text
TechWissen Workflow Installer
```

Den Schlüssel nicht in Git speichern.

Auf dem Rechner, auf dem das Installationsskript ausgeführt wird:

```bash
export N8N_API_KEY="DEIN_N8N_API_KEY"
```

Die öffentliche n8n-Basis-URL wird ebenfalls gesetzt. Bei einer Pfadinstallation beispielsweise:

```bash
export N8N_BASE_URL="https://DOMAIN/n8n"
```

Der Installer ergänzt selbst:

```text
/api/v1/...
```

## Ollama-Modell festlegen

Das gewünschte Modell wird beim Import in die Workflow-Definitionen eingesetzt:

```bash
export OLLAMA_MODEL="gemma3:1b"
```

Die interne Ollama-Adresse kann ebenfalls überschrieben werden:

```bash
export OLLAMA_BASE_URL="http://ollama:11434"
```

Standard ist bereits:

```text
http://ollama:11434
```

Das Modell muss im Ollama-Container verfügbar sein. Prüfe die installierten Modelle beispielsweise im Ollama-Container mit:

```bash
ollama list
```

## Ollama-Verbindung aus n8n prüfen

Öffne in Dokploy das Terminal des n8n-Containers und führe aus:

```bash
node -e "fetch('http://ollama:11434/api/tags').then(r=>r.json()).then(console.log).catch(e=>{console.error(e);process.exit(1)})"
```

Erwartet wird eine JSON-Antwort mit den in Ollama vorhandenen Modellen.

Das Beispielpaket enthält außerdem:

```bash
./scripts/check-ollama-from-n8n.sh
```

Dieses Skript ist für die Ausführung **innerhalb des n8n-Containers** gedacht.

## Workflows automatisch installieren

ZIP entpacken und in das Verzeichnis wechseln:

```bash
unzip n8n-praxis-workflows.zip
cd n8n-praxis-workflows
```

Variablen setzen:

```bash
export N8N_BASE_URL="https://DOMAIN/n8n"
export N8N_API_KEY="DEIN_N8N_API_KEY"
export OLLAMA_BASE_URL="http://ollama:11434"
export OLLAMA_MODEL="gemma3:1b"
```

Optional zuerst einen Dry Run durchführen:

```bash
./scripts/install-workflows.sh --dry-run
```

Danach installieren:

```bash
./scripts/install-workflows.sh
```

Das Skript ist idempotent:

```text
Workflow mit gleichem Namen vorhanden
→ Workflow wird aktualisiert

Workflow noch nicht vorhanden
→ Workflow wird erstellt
```

Die Installation verwendet die offizielle n8n Public API.

Die Workflows werden **nicht automatisch veröffentlicht**. Das ist beabsichtigt, damit du vor dem Aktivieren die Webhook-Authentifizierung und die Prompts prüfen kannst.

## Beispiel 0: Ollama-Verbindung als Workflow prüfen

Workflow:

```text
Webhook GET
   ↓
HTTP Request
   ↓
GET http://ollama:11434/api/tags
```

Webhook-Pfad:

```text
techwissen-ollama-health
```

Nach dem Veröffentlichen lautet die URL bei einer n8n-Pfadinstallation typischerweise:

```text
https://DOMAIN/n8n/webhook/techwissen-ollama-health
```

Test:

```bash
curl https://DOMAIN/n8n/webhook/techwissen-ollama-health
```

Die Antwort zeigt die von Ollama gemeldeten Modelle.

Dieser Workflow ist besonders nützlich nach:

- Ollama-Redeploy
- n8n-Redeploy
- Änderung von Docker-Netzen
- Modellupdates
- Änderungen an `ollama-internal`

## Beispiel 1: Notizen automatisch zusammenfassen

Anwendungsfälle:

- Besprechungsnotizen
- schnelle Gedanken vom Smartphone
- längere Chat-Notizen
- Tagesnotizen
- ungeordnete Stichpunkte

Workflow:

```text
Webhook
   ↓
Eingabe prüfen + Prompt erzeugen
   ↓
POST /api/generate → Ollama
   ↓
kompakte Antwort
```

Webhook-Pfad:

```text
techwissen-notizen-zusammenfassen
```

Beispiel:

```bash
curl -X POST \
  "https://DOMAIN/n8n/webhook/techwissen-notizen-zusammenfassen" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Montag Angebot prüfen. Dienstag Max wegen Termin anrufen. Backup des Servers kontrollieren.",
    "style": "sehr kurz"
  }'
```

Antwortstruktur:

```json
{
  "result": "...",
  "model": "...",
  "done": true
}
```

### Leicht anpassen

Im Code-Node kannst du die gewünschte Ausgabe verändern, beispielsweise:

```text
Erstelle nur drei Stichpunkte.
```

oder:

```text
Extrahiere zusätzlich Personen, Termine und offene Fragen.
```

Damit kann derselbe Workflow beispielsweise zu einem einfachen Meeting-Assistenten werden.

## Beispiel 2: E-Mail-Antwortentwurf erzeugen

Der Workflow **sendet keine E-Mail**. Er erstellt ausschließlich einen Entwurf. Das ist für den Einstieg bewusst sicherer.

Eingabe:

```json
{
  "sender": "Max Mustermann",
  "subject": "Termin nächste Woche",
  "message": "Hallo, passt dir Dienstag um 14 Uhr?",
  "tone": "freundlich und knapp"
}
```

Test:

```bash
curl -X POST \
  "https://DOMAIN/n8n/webhook/techwissen-email-entwurf" \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "Max Mustermann",
    "subject": "Termin nächste Woche",
    "message": "Hallo, passt dir Dienstag um 14 Uhr?",
    "tone": "freundlich und knapp"
  }'
```

Typische Anpassungen:

```text
Webhook
→ Gmail Trigger
→ Ollama
→ Gmail Draft
```

oder:

```text
IMAP Eingang
→ Filter
→ Ollama
→ Slack/Telegram zur Freigabe
→ E-Mail senden
```

Für produktive automatische E-Mail-Antworten sollte immer zuerst ein Freigabeschritt eingebaut werden.

## Beispiel 3: Aufgaben priorisieren

Eingabe als JSON-Array:

```json
{
  "tasks": [
    "Rechnung bezahlen",
    "Serverbackup prüfen",
    "Urlaub buchen",
    "Dokumentation aktualisieren"
  ],
  "context": "Feierabend, 90 Minuten verfügbar"
}
```

Der Workflow ordnet die Aufgaben in:

```text
JETZT
DANACH
SPÄTER
```

und nennt drei konkrete nächste Aktionen.

Test:

```bash
curl -X POST \
  "https://DOMAIN/n8n/webhook/techwissen-aufgaben-priorisieren" \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": ["Rechnung bezahlen", "Serverbackup prüfen", "Urlaub buchen"],
    "context": "heute noch 60 Minuten verfügbar"
  }'
```

### Mögliche Erweiterung

Statt des Webhooks kann die Aufgabenquelle später beispielsweise sein:

```text
Todoist
Microsoft To Do
Notion
Google Sheets
PostgreSQL
GitHub Issues
```

Der Ollama-Schritt bleibt gleich.

## Beispiel 4: Wochenplan erzeugen

Dieser Workflow kombiniert:

- Ziele
- feste Termine
- verfügbare Zeit
- persönliche Einschränkungen

Beispiel:

```bash
curl -X POST \
  "https://DOMAIN/n8n/webhook/techwissen-wochenplan" \
  -H "Content-Type: application/json" \
  -d '{
    "goals": "Sport zweimal; TechWissen-Artikel fertigstellen; Papierkram erledigen",
    "appointments": "Mittwoch 18 Uhr Termin; Freitag 16 Uhr Einkauf",
    "constraints": "werktags abends maximal 2 Stunden"
  }'
```

Der Prompt verlangt bewusst keinen komplett durchgetakteten Kalender, sondern Fokusblöcke und Puffer.

### Spätere Erweiterung

Ein praxisnaher Ausbau wäre:

```text
Schedule Trigger
      ↓
Google Calendar Termine abrufen
      ↓
Aufgabenliste abrufen
      ↓
Ollama Wochenplan
      ↓
E-Mail / Telegram / Notion
```

So bleibt die eigentliche LLM-Logik wiederverwendbar.

## Beispiel 5: Server-Logs analysieren

Dieses Beispiel passt direkt zum Contabo-/Dokploy-Umfeld.

Eingabe:

```json
{
  "service": "nginx",
  "log": "connect() failed (111: Connection refused) while connecting to upstream, upstream: http://backend:3000/api/health"
}
```

Test:

```bash
curl -X POST \
  "https://DOMAIN/n8n/webhook/techwissen-log-analyse" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "nginx",
    "log": "connect() failed (111: Connection refused) while connecting to upstream, upstream: http://backend:3000/api/health"
  }'
```

Der Prompt verlangt ausdrücklich:

- wahrscheinlichste Ursache
- Indizien
- sichere Prüfkommandos
- risikoarme Behebung
- Dinge, die nicht automatisch ausgeführt werden sollen

Damit ist der Workflow als **Analysehilfe** gedacht, nicht als autonomer Root-Administrator.

## Alle Webhooks testen

Nach dem Prüfen, Absichern und Veröffentlichen der Workflows:

```bash
export N8N_WEBHOOK_BASE_URL="https://DOMAIN/n8n/webhook"
./scripts/test-webhooks.sh
```

Das Skript ruft alle Beispiele mit kleinen Testdaten auf.

## Beispiele anpassen

Für die meisten Anpassungen reichen vier Stellen.

### 1. Webhook-Pfad

Im Webhook Node:

```text
techwissen-notizen-zusammenfassen
```

kann beispielsweise werden:

```text
meine-notizen
```

### 2. Eingabefelder

Im Code Node wird die Payload gelesen:

```javascript
const body = input.body ?? {};
```

Weitere Felder lassen sich dort einfach ergänzen.

### 3. Prompt

Der Prompt ist der wichtigste fachliche Teil des Workflows.

Ändere zunächst nur:

```text
Rolle
Aufgabe
Ausgabeformat
Grenzen
```

und lasse die technische Ollama-Anbindung unverändert.

### 4. Ziel nach Ollama

Aktuell endet jeder Beispielworkflow mit der Webhook-Antwort.

Danach kann stattdessen beispielsweise folgen:

```text
E-Mail
Telegram
Discord
Slack
Notion
Google Sheets
PostgreSQL
GitHub
```

## Lokales Modell wechseln

Die Beispiele werden beim Import mit dem Wert aus:

```bash
OLLAMA_MODEL
```

gerendert.

Beispiel:

```bash
export OLLAMA_MODEL="DEIN_MODELL"
./scripts/install-workflows.sh
```

Da der Installer idempotent arbeitet, werden bestehende TechWissen-Beispielworkflows aktualisiert.

Wichtig: Das Modell muss in der lokalen Ollama-Instanz vorhanden sein.

## Cloud-Modell statt lokalem Modell

Das Ollama-Dokploy-Paket unterstützt zusätzlich Cloud-Funktionen. Für die hier gezeigten Beispiele ist jedoch der lokale interne Endpoint die einfachste Variante:

```text
http://ollama:11434
```

Wenn ein Cloud-Modell über die lokale Ollama-Instanz geroutet wird, bleibt die Workflow-URL gleich. Die Authentifizierung des lokalen Ollama-Daemons zur Cloud ist davon getrennt.

Für direkten Zugriff auf `ollama.com` sollte dagegen nicht einfach der lokale Endpoint ersetzt und ein API-Key in einen Workflow geschrieben werden. Nutze dafür n8n Credentials oder den offiziellen Ollama-Credential-Mechanismus.

## Deployment in Dokploy

An der öffentlichen Dokploy-Konfiguration von n8n ändert sich durch diese Workflows nichts.

Für eine Pfadinstallation beispielsweise:

```text
Domain:         DOMAIN
Path:           /n8n
Service:        n8n
Container Port: 5678
Strip Path:     OFF
HTTPS:          ON
```

Die n8n-Konfiguration verwendet entsprechend:

```env
N8N_PATH=/n8n/
N8N_EDITOR_BASE_URL=https://DOMAIN/n8n/
WEBHOOK_URL=https://DOMAIN/n8n/
```

Ollama erhält weiterhin:

```text
keine Dokploy-Domain
kein öffentliches Port-Mapping
```

und ist ausschließlich über `ollama-internal` erreichbar.

## Deployment prüfen

Prüfe zuerst das Docker-Netz:

```bash
docker network inspect ollama-internal
```

Der n8n- und der Ollama-Container müssen im Netzwerk erscheinen.

Danach im n8n-Container:

```bash
node -e "fetch('http://ollama:11434/api/tags').then(r=>r.json()).then(console.log)"
```

Dann Installer als Dry Run:

```bash
./scripts/install-workflows.sh --dry-run
```

Danach echter Import:

```bash
./scripts/install-workflows.sh
```

In n8n sollten anschließend sechs neue Workflows mit Namen `TechWissen 00` bis `TechWissen 05` sichtbar sein.

Vor Veröffentlichung jeden Workflow einmal im Editor öffnen und prüfen.

## Sicherheitskonzept

### Ollama bleibt intern

Ollama wird nicht öffentlich erreichbar gemacht.

Nicht verwenden:

```yaml
ports:
  - "11434:11434"
```

Nicht in Dokploy anlegen:

```text
öffentliche Ollama-Domain
```

### n8n API-Key schützen

`N8N_API_KEY` gehört:

- nicht in Git
- nicht in Workflow-JSON
- nicht in TechWissen-Artikel
- nicht in Screenshots

Nach einem einmaligen Import kann der API-Key bei Bedarf wieder widerrufen werden.

### Webhooks vor Veröffentlichung absichern

Die Beispielworkflows werden absichtlich **nicht automatisch veröffentlicht**.

Vor dem Veröffentlichen solltest du für öffentlich erreichbare Webhooks im Webhook-Node Authentifizierung konfigurieren, beispielsweise über ein geeignetes n8n-Credential.

Ein Webhook ohne Authentifizierung kann sonst von jedem aufgerufen werden, der seine URL kennt.

### LLM-Ausgaben nicht blind ausführen

Besonders beim Log-Analyse-Beispiel gilt:

```text
LLM-Ausgabe = Vorschlag / Analyse
nicht = automatisch vertrauenswürdiger Shell-Befehl
```

Führe keine generierten Root-, Docker-, Datenbank- oder Löschkommandos automatisch aus.

### Persönliche Daten

Bei lokalem Ollama bleiben Prompts im eigenen Infrastrukturpfad, sofern der Workflow keine externen Dienste aufruft und kein Cloud-Modell verwendet wird.

Trotzdem sollte n8n nur Daten verarbeiten, die für den jeweiligen Workflow tatsächlich notwendig sind.

## Logs und Fehlersuche

n8n-Logs in Dokploy prüfen oder per Compose:

```bash
docker compose logs -f n8n
```

Ollama-Logs:

```bash
docker compose logs -f ollama
```

Typische Fehler:

### `ECONNREFUSED ollama:11434`

Prüfe:

```text
ollama-internal vorhanden?
n8n im Netz?
Ollama im Netz?
Ollama-Container healthy/running?
```

### Modell nicht gefunden

Prüfe im Ollama-Container:

```bash
ollama list
```

und vergleiche den Modellnamen mit:

```bash
OLLAMA_MODEL
```

### Installer erhält HTTP 401

Der n8n-API-Key fehlt, ist falsch oder abgelaufen.

### Installer erreicht `/api/v1` nicht

Prüfe `N8N_BASE_URL`.

Bei einer Pfadinstallation muss sie den Pfad enthalten:

```text
https://DOMAIN/n8n
```

nicht nur:

```text
https://DOMAIN
```

## Backups

Die Workflow-Definitionen selbst liegen im Beispielpaket als JSON-Dateien vor.

Für die produktive n8n-Instanz müssen weiterhin mindestens gesichert werden:

- n8n-Datenbank
- n8n-Datenvolume
- `N8N_ENCRYPTION_KEY`
- notwendige Dokploy Environment/Secrets

Ollama-Modelle können bei Bedarf neu geladen werden; wenn lokale Modelldaten nicht erneut heruntergeladen werden sollen, muss auch das Ollama-Volume in die Backup-Strategie aufgenommen werden.

## Updates

Vor einem n8n-Update:

1. n8n-Release Notes prüfen.
2. Datenbank und n8n-Daten sichern.
3. wichtige Workflows exportieren oder das Beispielpaket aktuell halten.
4. n8n-Version gezielt aktualisieren.
5. Ollama-Verbindung prüfen.
6. mindestens einen Beispielworkflow testen.

Der Installer kann nach einem Update erneut ausgeführt werden:

```bash
./scripts/install-workflows.sh
```

## Produktionscheckliste

- [ ] n8n läuft per HTTPS hinter Dokploy/Traefik
- [ ] n8n ist mit `ollama-internal` verbunden
- [ ] Ollama besitzt keine öffentliche Domain
- [ ] Ollama besitzt kein Host-Port-Mapping für `11434`
- [ ] `http://ollama:11434/api/tags` ist aus n8n erreichbar
- [ ] gewünschtes Ollama-Modell ist installiert
- [ ] n8n API-Key wurde separat und sicher gespeichert
- [ ] Beispielworkflows wurden per Installer importiert
- [ ] jeder Workflow wurde vor Veröffentlichung geprüft
- [ ] öffentliche Webhooks besitzen geeignete Authentifizierung
- [ ] keine API-Keys stehen in Workflow-JSONs
- [ ] LLM-Ausgaben führen keine privilegierten Kommandos automatisch aus
- [ ] n8n-Datenbank und Encryption Key werden gesichert

## Empfohlene endgültige Architektur

```text
Contabo VPS
│
├── Dokploy / Traefik
│    └── HTTPS → n8n:5678
│
├── n8n
│    ├── n8n-private → PostgreSQL
│    ├── n8n-egress  → externe APIs
│    └── ollama-internal
│          │
│          ▼
│        Ollama:11434
│
└── Ollama
     ├── keine öffentliche Domain
     ├── kein Host-Port-Mapping
     └── persistente Modelldaten
```

Die Beispielworkflows sitzen vollständig in der n8n-Schicht. Ollama bleibt ein austauschbarer interner LLM-Dienst.

## Quellen

- [n8n Public API – Workflow](https://docs.n8n.io/connect/n8n-api/workflow)
- [n8n Public API – Authentication](https://docs.n8n.io/connect/n8n-api/authentication)
- [n8n – Export and import workflows](https://docs.n8n.io/build/manage-workflows/export-and-import)
- [n8n – Webhook Node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [n8n – HTTP Request Node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)
- [Ollama API – Introduction](https://docs.ollama.com/api/introduction)
- [Ollama API – Generate](https://docs.ollama.com/api/generate)
- [Ollama API – List models](https://docs.ollama.com/api/tags)
- [Ollama – n8n integration](https://docs.ollama.com/integrations/n8n)
