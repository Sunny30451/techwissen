# Hermes Agent mit einem Discord-Server verbinden und in einem eigenen Kanal bereitstellen

Hermes Agent von Nous Research besitzt eine native Discord-Integration über das Hermes Gateway. Dadurch kann der auf dem Contabo-VPS in Docker/Dokploy betriebene Hermes-Agent direkt als Discord-Bot in einem Server erscheinen und Nachrichten aus einem festgelegten Kanal verarbeiten.

Diese Anleitung baut auf den bestehenden TechWissen-Anleitungen für den Hermes-Dokploy-Container und den Discord-Server auf. Der Discord-Server selbst bleibt bei Discord gehostet. Hermes läuft weiterhin auf dem Contabo-VPS und baut ausgehend eine Verbindung zu Discord auf.

Ziel ist ein eigener Discord-Kanal, beispielsweise:

```text
#hermes
```

in dem berechtigte Benutzer direkt mit Hermes kommunizieren können.

## Zielarchitektur

```text
Discord Cloud
└── Discord-Server
    └── Kategorie: AI & Automation
        └── #hermes
             │
             │ Discord Gateway / HTTPS
             ▼
Contabo VPS
└── Ubuntu
    └── Docker / Dokploy
        ├── Hermes Agent
        │   ├── Hermes Gateway
        │   ├── Discord Adapter
        │   └── persistentes hermes-data
        │
        └── ollama-internal
             └── Ollama :11434
```

Hermes ist dabei über Discord erreichbar, ohne dass für die Discord-Integration ein neuer öffentlicher Port am Contabo-VPS geöffnet werden muss.

Der Hermes-Gateway-Container stellt die Verbindung zu Discord ausgehend her.

Für das bestehende Ollama-Dokploy-Paket verwendet Hermes weiterhin:

```text
http://ollama:11434/v1
```

über das interne Docker-Netz:

```text
ollama-internal
```

## Voraussetzungen

Benötigt werden:

- bestehender Discord-Server,
- Berechtigung **Server verwalten** zum Hinzufügen des Bots,
- Hermes-Agent als Dokploy-/Docker-Container,
- Hermes-Persistenz unter `/opt/data`,
- funktionierender LLM-Provider,
- optional das bestehende Ollama-Dokploy-Paket,
- Zugriff auf das Discord Developer Portal,
- Dokploy Environment/Secrets.

Bei Ollama muss für Hermes weiterhin ein ausreichend großes Kontextfenster verwendet werden. Für Agent-/Tool-Nutzung sollte das bestehende Ollama-Paket mit mindestens:

```env
OLLAMA_CONTEXT_LENGTH=64000
```

konfiguriert sein.

Je nach Modell kann dies auf einem VPS erheblichen RAM-/VRAM-Bedarf verursachen.

## Funktionsweise der Discord-Integration

Hermes besitzt einen nativen Discord-Plattformadapter.

Der Datenfluss lautet:

```text
Benutzer
   │
   ▼
Discord #hermes
   │
   ▼
Discord Gateway
   │
   ▼
Hermes Gateway
   │
   ▼
Hermes Agent
   │
   ├── Memory
   ├── Tools
   ├── Skills
   └── LLM
        │
        └── Ollama / Cloud Provider
```

Hermes kann in Discord unter anderem:

- Textnachrichten verarbeiten,
- Antworten streamen,
- Dateien verarbeiten,
- Slash Commands bereitstellen,
- Threads verwenden,
- Reaktionen senden,
- Tool-Aufrufe ausführen,
- Erinnerungen und Agent-Kontext nutzen.

## Discord-Kanal erstellen

Im gewünschten Discord-Server eine neue Kategorie anlegen:

```text
AI & Automation
```

Darunter einen Textkanal:

```text
#hermes
```

Empfohlene Kanalbeschreibung:

```text
Direkter Zugriff auf den selbst gehosteten Hermes Agent.
Keine Passwörter, API-Keys oder vertraulichen Produktionsdaten eingeben.
```

### Kanalberechtigungen

Beispielsweise:

```text
@everyone
→ Kanal anzeigen: Nein
```

Neue Rolle:

```text
Hermes Users
```

Für diese Rolle:

```text
Kanal anzeigen       Ja
Nachrichten senden   Ja
Verlauf lesen        Ja
```

Dadurch ist der Agent nicht automatisch für jedes Discord-Mitglied erreichbar.

## Discord Application erstellen

Discord Developer Portal öffnen:

```text
https://discord.com/developers/applications
```

Dann:

1. **New Application** auswählen.
2. Namen vergeben:

```text
Hermes Agent
```

3. Anwendung erstellen.
4. Unter **Bot** den Bot konfigurieren.
5. Optional Avatar und Beschreibung setzen.

Der Bot-Token wird später von Hermes verwendet.

## Privileged Gateway Intents

Im Discord Developer Portal:

```text
Application
→ Bot
→ Privileged Gateway Intents
```

Für Hermes muss mindestens aktiviert werden:

```text
Message Content Intent
```

Wenn Rollen-Allowlisten verwendet werden:

```env
DISCORD_ALLOWED_ROLES=...
```

oder Benutzerauflösung über Member-Daten benötigt wird, zusätzlich:

```text
Server Members Intent
```

aktivieren.

**Presence Intent** ist für die normale Hermes-Nutzung nicht erforderlich.

Ohne Message Content Intent kann der Bot zwar online erscheinen, aber den Text normaler Discord-Nachrichten nicht lesen.

## Bot-Token erzeugen

Unter:

```text
Developer Portal
→ Application
→ Bot
→ Token
```

Token erzeugen bzw. zurücksetzen.

Beispiel:

```text
DISCORD_BOT_TOKEN=...
```

Der Token ist ein Secret.

Er darf nicht in:

```text
Git
Dockerfile
docker-compose.yml
TechWissen-Artikel
Discord-Kanal
```

gespeichert werden.

Er gehört in:

```text
Dokploy
→ Environment / Secrets
```

Bei einem kompromittierten Token:

1. Token im Discord Developer Portal zurücksetzen.
2. Dokploy Secret aktualisieren.
3. Hermes redeployen bzw. Gateway neu starten.

## Bot-Berechtigungen festlegen

Beim Einladen benötigt Hermes mindestens:

```text
View Channels
Send Messages
Read Message History
Attach Files
```

Empfohlen zusätzlich:

```text
Embed Links
Send Messages in Threads
Add Reactions
```

Keine Administrator-Berechtigung vergeben.

Empfohlenes Permission-Set laut Hermes-Dokumentation:

```text
274878286912
```

Dieses enthält die empfohlenen Messaging-, Thread- und Reaction-Berechtigungen.

## Bot zum Discord-Server hinzufügen

Im Discord Developer Portal:

```text
Installation
```

konfigurieren:

```text
Installation Context:
Guild Install
```

Scopes:

```text
bot
applications.commands
```

Anschließend den generierten Installationslink öffnen und den gewünschten Discord-Server auswählen.

Alternativ kann eine OAuth2-URL mit der Application-ID verwendet werden.

Nach der Installation erscheint Hermes zunächst möglicherweise **offline**, solange das Hermes Gateway noch nicht gestartet bzw. konfiguriert wurde.

## Discord Developer Mode aktivieren

Für die Hermes-Konfiguration werden numerische IDs benötigt.

Discord:

```text
Benutzereinstellungen
→ Erweitert
→ Entwicklermodus
→ Aktivieren
```

Danach können per Rechtsklick IDs kopiert werden.

Benötigt werden mindestens:

```text
Discord User ID
Discord Channel ID von #hermes
```

Optional:

```text
Discord Role ID von "Hermes Users"
Discord Server/Guild ID
```

## Zugriffskonzept

Hermes besitzt mehrere Zugriffsbeschränkungen.

Für einen produktiven Discord-Kanal empfehle ich **zwei Ebenen gleichzeitig**:

```text
1. DISCORD_ALLOWED_CHANNELS
2. DISCORD_ALLOWED_USERS oder DISCORD_ALLOWED_ROLES
```

Damit muss sowohl der Kanal als auch der Benutzer bzw. dessen Rolle erlaubt sein.

### Variante A: einzelne Benutzer

```env
DISCORD_ALLOWED_USERS=123456789012345678,234567890123456789
```

### Variante B: Discord-Rolle

Für einen Server ist eine Rollen-Allowlist meist wartbarer:

```env
DISCORD_ALLOWED_ROLES=345678901234567890
```

Die ID entspricht beispielsweise der Rolle:

```text
Hermes Users
```

Neue Nutzer erhalten dann lediglich diese Rolle.

## Hermes auf genau einen Discord-Kanal beschränken

Channel-ID von `#hermes` kopieren.

Beispiel:

```text
456789012345678901
```

In Dokploy:

```env
DISCORD_ALLOWED_CHANNELS=456789012345678901
```

Hermes verarbeitet dadurch Servernachrichten nur in diesem Kanal.

Das ist sicherer als den Bot serverweit reagieren zu lassen.

## Kommunikation ohne @Mention

Hermes verlangt in normalen Serverkanälen standardmäßig eine Erwähnung:

```text
@Hermes Agent erkläre Docker Networks
```

Für einen dedizierten `#hermes`-Kanal ist das unnötig.

Deshalb:

```env
DISCORD_FREE_RESPONSE_CHANNELS=456789012345678901
```

Damit reicht im Kanal:

```text
Erkläre mir den Unterschied zwischen Docker Volume und Bind Mount.
```

Hermes antwortet direkt.

Die globale Einstellung:

```env
DISCORD_REQUIRE_MENTION=false
```

würde Hermes in allen erlaubten Kanälen mention-frei reagieren lassen.

Für einen gezielten `#hermes`-Kanal ist `DISCORD_FREE_RESPONSE_CHANNELS` die bessere Wahl.

## Home Channel konfigurieren

Der Hermes-Discord-Adapter unterstützt einen Home Channel.

Dieser kann beispielsweise für geplante Nachrichten oder Benachrichtigungen verwendet werden:

```env
DISCORD_HOME_CHANNEL=456789012345678901
DISCORD_HOME_CHANNEL_NAME=hermes
```

Damit kann Hermes geplante Ausgaben gezielt in den Kanal `#hermes` liefern.

## Dokploy Environment Settings

Für das bestehende Hermes-Dokploy-Paket ergänzen:

```env
# Discord
DISCORD_BOT_TOKEN=DEIN_DISCORD_BOT_TOKEN

# Zugriff
DISCORD_ALLOWED_CHANNELS=456789012345678901
DISCORD_ALLOWED_ROLES=345678901234567890

# Dedizierter mention-freier Hermes-Kanal
DISCORD_FREE_RESPONSE_CHANNELS=456789012345678901

# Standardverhalten für andere Kanäle
DISCORD_REQUIRE_MENTION=true

# Home Channel
DISCORD_HOME_CHANNEL=456789012345678901
DISCORD_HOME_CHANNEL_NAME=hermes
```

Alternativ zu `DISCORD_ALLOWED_ROLES`:

```env
DISCORD_ALLOWED_USERS=123456789012345678
```

Nicht empfohlen:

```env
DISCORD_ALLOW_ALL_USERS=true
```

für einen öffentlichen oder produktiven Server.

Diese Option ist eher für kontrollierte Entwicklungsumgebungen geeignet.

## Docker Compose erweitern

Im Hermes-Service werden die Variablen aus Dokploy übernommen.

Beispiel:

```yaml
services:

  hermes:
    image: ${HERMES_IMAGE:-nousresearch/hermes-agent:latest}
    restart: unless-stopped

    environment:
      DISCORD_BOT_TOKEN: ${DISCORD_BOT_TOKEN}
      DISCORD_ALLOWED_USERS: ${DISCORD_ALLOWED_USERS:-}
      DISCORD_ALLOWED_ROLES: ${DISCORD_ALLOWED_ROLES:-}
      DISCORD_ALLOWED_CHANNELS: ${DISCORD_ALLOWED_CHANNELS}
      DISCORD_FREE_RESPONSE_CHANNELS: ${DISCORD_FREE_RESPONSE_CHANNELS:-}
      DISCORD_REQUIRE_MENTION: ${DISCORD_REQUIRE_MENTION:-true}
      DISCORD_HOME_CHANNEL: ${DISCORD_HOME_CHANNEL:-}
      DISCORD_HOME_CHANNEL_NAME: ${DISCORD_HOME_CHANNEL_NAME:-hermes}

    volumes:
      - hermes-data:/opt/data

    networks:
      - hermes-egress
      - ollama-internal

networks:

  hermes-egress:
    driver: bridge

  ollama-internal:
    external: true

volumes:
  hermes-data:
```

Der Discord-Bot benötigt ausgehenden Internetzugriff.

Deshalb darf Hermes nicht ausschließlich an einem Docker-Netz mit:

```yaml
internal: true
```

hängen.

`ollama-internal` bleibt zusätzlich für die Kommunikation mit dem lokalen Ollama-Container erhalten.

## Hermes Gateway starten

Hermes muss mit laufendem Gateway betrieben werden.

Im Container kann die Einrichtung zunächst geprüft werden mit:

```bash
hermes gateway setup
```

oder nach manueller Environment-Konfiguration:

```bash
hermes gateway
```

Beim offiziellen Hermes-Docker-Setup werden persistente Gateway-/Profil-Dienste durch die Container-Service-Struktur verwaltet.

Nach einer Änderung der Discord-Secrets oder Allowlist:

```text
Dokploy
→ Hermes
→ Redeploy / Restart
```

anschließend Gateway-Logs kontrollieren.

## Deployment in Dokploy

Die Discord-Integration benötigt **keine neue öffentliche Dokploy-Domain**.

Der Datenfluss ist ausgehend:

```text
Hermes Container
      │
      │ HTTPS / WebSocket
      ▼
Discord
```

Nicht erforderlich:

```text
ports:
  - "xxxx:xxxx"
```

Für die bisherige Hermes-Installation bleiben Dashboard/API-Konventionen unverändert.

Wenn das Hermes-Dashboard nicht benötigt wird:

```env
HERMES_DASHBOARD=0
```

lassen.

Der Discord-Zugriff funktioniert unabhängig von einer öffentlichen Hermes-Dashboard-Domain.

## Deployment prüfen

### Hermes-Container

In Dokploy:

```text
Hermes
→ Logs
```

oder per Docker:

```bash
docker compose logs -f hermes
```

Gesucht werden Meldungen, dass Discord verbunden wurde.

### Bot-Status

Im Discord-Server sollte:

```text
Hermes Agent
```

als online erscheinen.

### Kanaltest

In:

```text
#hermes
```

beispielsweise:

```text
Hallo Hermes. Antworte mit "Discord-Verbindung funktioniert".
```

Da der Kanal unter:

```env
DISCORD_FREE_RESPONSE_CHANNELS
```

eingetragen ist, sollte kein `@Hermes` erforderlich sein.

### Negativtest

In einem anderen Kanal:

```text
#allgemein
```

eine Nachricht senden.

Wenn `DISCORD_ALLOWED_CHANNELS` nur die `#hermes`-ID enthält, darf Hermes dort nicht reagieren.

### Berechtigungstest

Mit einem Nutzer ohne:

```text
Hermes Users
```

in `#hermes` schreiben.

Bei Rollen-Allowlist darf Hermes diesen Benutzer nicht bedienen.

## Funktionstest

Empfohlene Testmatrix:

| Test | Erwartung |
|---|---|
| Berechtigter Nutzer schreibt in `#hermes` | Hermes antwortet |
| Kein `@Hermes` in `#hermes` | Hermes antwortet |
| Berechtigter Nutzer schreibt in anderem Kanal | Hermes ignoriert |
| Nicht berechtigter Nutzer schreibt in `#hermes` | Hermes verweigert/ignoriert |
| `/help` oder Hermes Slash Command | funktioniert |
| Hermes fragt Ollama an | Antwort wird erzeugt |
| Ollama nicht erreichbar | Fehler erscheint im Hermes-Log |
| Discord Bot Token ungültig | Bot bleibt offline |
| Message Content Intent fehlt | Bot reagiert nicht auf normalen Text |

## Session-Modell

Discord-Kanäle können mehrere Personen enthalten.

Für einen gemeinsam genutzten `#hermes`-Kanal ist relevant, ob Gesprächskontext pro Benutzer getrennt werden soll.

Empfohlen:

```yaml
group_sessions_per_user: true
```

Dadurch werden Unterhaltungen mehrerer Benutzer im gleichen Discord-Kanal nicht unnötig in einen gemeinsamen Gesprächsverlauf gemischt.

Wenn der Kanal bewusst als gemeinsamer Agent-Raum genutzt werden soll, kann diese Trennung deaktiviert bleiben.

## Optional: eigener Hermes-Profile für Discord

Für komplexere Installationen kann Hermes mehrere Profile verwenden.

Beispielsweise:

```text
default
→ persönlicher Hermes-Agent

discord-community
→ Discord-Agent
```

Ein Discord-Kanal kann über Hermes Profile Routing einem separaten Profil zugeordnet werden.

Beispielidee:

```yaml
gateway:
  multiplex_profiles: true

  profile_routes:
    - name: discord-hermes
      platform: discord
      guild_id: "SERVER_ID"
      chat_id: "CHANNEL_ID"
      profile: discord-community
```

Damit kann `#hermes` besitzen:

- eigenes System-Prompt,
- eigene Skills,
- eigene Memory,
- eigenes Modell,
- eigene Credentials.

Das ist besonders sinnvoll, wenn der persönliche Hermes-Agent mehr Zugriffsrechte besitzt als der Discord-Agent.

## Empfohlenes Sicherheitsmodell

Für einen Community- oder Mehrbenutzer-Server empfehle ich:

```text
Persönlicher Hermes
        │
        └── private Nutzung

Discord Hermes
        │
        ├── separates Profil
        ├── begrenzte Tools
        ├── begrenztes Memory
        └── #hermes
```

Der Discord-Agent sollte nicht automatisch Zugriff auf sämtliche Secrets oder administrativen Tools des persönlichen Agenten erhalten.

## Tool-Berechtigungen

Hermes besitzt für Discord eigene Toolsets.

Je nach Konfiguration kann Hermes:

- Nachrichten lesen,
- Nachrichten senden,
- Channels auflisten,
- Reaktionen setzen,
- Mitglieder suchen,
- Discord-Server verwalten.

Administrative Discord-Tools sollten nur aktiviert werden, wenn Hermes tatsächlich Moderations- oder Serververwaltungsaufgaben übernehmen soll.

Für einen normalen AI-Chat-Kanal reichen Messaging-Funktionen.

Keine unnötigen:

```text
Kick
Ban
Role Management
Channel Management
```

Berechtigungen vergeben.

## Sicherheitskonzept

### Discord Bot Token

Das Bot-Token ist ein Hochrisiko-Secret.

Speicherung ausschließlich in:

```text
Dokploy Environment / Secrets
```

### Channel Allowlist

Produktiv immer:

```env
DISCORD_ALLOWED_CHANNELS=CHANNEL_ID
```

verwenden, wenn Hermes nur in einem bestimmten Kanal verfügbar sein soll.

### User- oder Role-Allowlist

Zusätzlich mindestens eine Zugriffspolitik:

```env
DISCORD_ALLOWED_USERS=...
```

oder:

```env
DISCORD_ALLOWED_ROLES=...
```

Hermes arbeitet bei extern erreichbaren Adaptern bewusst fail-closed, wenn keine Zugriffspolitik vorhanden ist.

### Kein Allow-All

Nicht produktiv:

```env
DISCORD_ALLOW_ALL_USERS=true
```

### Keine Administratorrolle

Der Hermes-Bot benötigt für normale Unterhaltung keine Discord-Administratorberechtigung.

### Agent-Tools begrenzen

Discord-Nutzer können den Hermes-Agent durch natürliche Sprache steuern.

Deshalb ist die entscheidende Sicherheitsgrenze nicht nur Discord selbst, sondern auch:

```text
Welche Tools darf dieser Hermes-Agent ausführen?
```

Insbesondere sollten in einem Community-Profil keine unbeschränkten Host-, Docker-, SSH- oder Secret-Zugriffe vorhanden sein.

### Prompt Injection berücksichtigen

Dateien, Webseiten und Nachrichten können untrusted Content enthalten.

Hermes sollte nicht blind administrative Aktionen ausführen, nur weil Inhalte in Discord dies anweisen.

## Logs

Hermes:

```bash
docker compose logs -f hermes
```

oder in Dokploy:

```text
Hermes
→ Logs
```

Gateway-Log im Hermes-Datenbereich je nach Installation:

```text
~/.hermes/logs/gateway.log
```

Zu prüfen:

- Discord Connection,
- Authentication,
- Access Policy,
- Channel Filter,
- Intents,
- Ollama/LLM-Fehler,
- Tool-Aufrufe.

Tokens dürfen nicht in Logs veröffentlicht werden.

## Healthcheck

Praktische Prüfungen:

1. Hermes-Container läuft.
2. Gateway-Prozess läuft.
3. Bot erscheint online.
4. `#hermes` beantwortet Nachrichten.
5. andere Channels werden ignoriert.
6. nicht autorisierte Nutzer werden abgewiesen.
7. LLM/Ollama liefert Antworten.

Optional kann Hermes selbst regelmäßig eine Statusmeldung in den Home Channel senden.

## Backups

Die Discord-Konfiguration selbst liegt teilweise bei Discord.

Zu sichern sind auf dem Contabo-VPS insbesondere:

```text
hermes-data
```

mit:

- Hermes-Konfiguration,
- Profile,
- Memory,
- Skills,
- Sessions,
- Gateway-Konfiguration.

Secrets sollten zusätzlich sicher außerhalb des Servers dokumentiert bzw. in einem Secret-/Password-Manager gespeichert werden.

Die Discord Bot Application kann bei Verlust des Tokens einen neuen Token erzeugen.

## Updates

Vor Hermes-Updates:

1. `hermes-data` sichern.
2. Hermes Release Notes prüfen.
3. Container-Image aktualisieren.
4. Redeploy.
5. Discord Gateway Logs kontrollieren.
6. Channel-Allowlist testen.
7. Slash Commands testen.
8. Ollama/LLM-Verbindung prüfen.

Nach Discord-Änderungen:

- Bot Permissions,
- Privileged Intents,
- Role IDs,
- Channel IDs

erneut kontrollieren.

## Troubleshooting

### Bot ist online, antwortet aber nicht

Häufigste Ursachen:

```text
Message Content Intent nicht aktiviert
```

oder:

```text
keine Hermes Access Policy konfiguriert
```

Prüfen:

```env
DISCORD_ALLOWED_USERS=...
```

oder:

```env
DISCORD_ALLOWED_ROLES=...
```

sowie:

```env
DISCORD_ALLOWED_CHANNELS=...
```

### Bot kann Kanal nicht sehen

Discord:

```text
#hermes
→ Kanal bearbeiten
→ Berechtigungen
```

Bot-Rolle benötigt:

```text
View Channel
Read Message History
Send Messages
```

### Hermes verlangt weiterhin @Mention

Prüfen:

```env
DISCORD_FREE_RESPONSE_CHANNELS=CHANNEL_ID
```

Die ID muss die numerische Channel-ID sein, nicht:

```text
#hermes
```

### User not allowed

Prüfen:

```env
DISCORD_ALLOWED_USERS
```

oder:

```env
DISCORD_ALLOWED_ROLES
```

Bei Rollen-Allowlist muss außerdem der Server Members Intent aktiviert sein.

### Bot offline

Prüfen:

```text
DISCORD_BOT_TOKEN
Hermes Gateway
Container Logs
Internetzugriff
```

### Ollama nicht erreichbar

Aus Hermes:

```text
http://ollama:11434
```

bzw. als OpenAI-kompatibler Provider:

```text
http://ollama:11434/v1
```

Nicht:

```text
localhost:11434
```

Beide Container müssen am externen Netzwerk:

```text
ollama-internal
```

hängen.

## Produktionscheckliste

- [ ] Discord Application erstellt
- [ ] Discord Bot erstellt
- [ ] Message Content Intent aktiviert
- [ ] Server Members Intent bei Rollen-Allowlist aktiviert
- [ ] Bot-Token ausschließlich in Dokploy Secrets
- [ ] Bot ohne Administrator-Berechtigung
- [ ] eigener Kanal `#hermes` erstellt
- [ ] Discord-Rolle `Hermes Users` erstellt
- [ ] Channel-ID kopiert
- [ ] Role-ID oder User-IDs kopiert
- [ ] `DISCORD_ALLOWED_CHANNELS` gesetzt
- [ ] `DISCORD_ALLOWED_ROLES` oder `DISCORD_ALLOWED_USERS` gesetzt
- [ ] `DISCORD_FREE_RESPONSE_CHANNELS` gesetzt
- [ ] `DISCORD_ALLOW_ALL_USERS` nicht produktiv aktiviert
- [ ] Hermes Gateway läuft
- [ ] `#hermes` antwortet ohne Mention
- [ ] andere Kanäle werden ignoriert
- [ ] unberechtigte Nutzer getestet
- [ ] Ollama-/LLM-Verbindung getestet
- [ ] Agent-Tools für Discord-Nutzung begrenzt
- [ ] `hermes-data` im Backup enthalten

## Empfohlene endgültige Architektur

```text
Discord
└── Discord Server
    └── AI & Automation
        └── #hermes
             │
             ├── Discord Channel Permission
             │      └── Hermes Users
             │
             └── Hermes Access Policy
                    ├── DISCORD_ALLOWED_CHANNELS
                    └── DISCORD_ALLOWED_ROLES
                              │
                              ▼
Contabo VPS
└── Dokploy
    └── Hermes Agent
        ├── Discord Gateway
        ├── eingeschränkte Tools
        ├── hermes-data
        └── ollama-internal
             └── Ollama
```

Für eine Mehrbenutzer-Community ist zusätzlich ein separates Hermes-Profil für Discord empfehlenswert, damit persönliches Memory, administrative Tools und private Credentials vom Community-Agent getrennt bleiben.

## Quellen

- Hermes Agent – Discord Setup: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord/
- Hermes Agent – Environment Variables: https://hermes-agent.nousresearch.com/docs/reference/environment-variables
- Hermes Agent – Built-in Tools Reference: https://hermes-agent.nousresearch.com/docs/reference/tools-reference/
- Hermes Agent – Multi-Profile Gateways: https://hermes-agent.nousresearch.com/docs/user-guide/multi-profile-gateways
- Hermes Agent Repository: https://github.com/NousResearch/hermes-agent
- Discord Developer Portal: https://discord.com/developers/applications
