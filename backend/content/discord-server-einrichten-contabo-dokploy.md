# Discord-Server einrichten, absichern und mit Contabo/Dokploy integrieren

Discord ist eine gehostete Kommunikationsplattform für Text-, Sprach- und Community-Funktionen. Ein Discord-Server wird nicht auf dem eigenen Contabo-VPS installiert: Die eigentliche Discord-Infrastruktur läuft bei Discord. Der eigene Contabo-VPS mit Docker und Dokploy kann jedoch sehr sinnvoll als Integrationsplattform dienen – zum Beispiel für n8n-Workflows, eigene Bots, Statusmeldungen, Monitoring oder Webhook-Sender.

Diese Anleitung zeigt die praktische Einrichtung eines Discord-Servers, ein wartbares Rollen- und Kanalmodell, Sicherheitsmaßnahmen sowie die optionale Anbindung an die bestehende Contabo-/Dokploy-Infrastruktur.

## Zielarchitektur

```text
Discord
└── Discord-Server
    ├── Kategorien und Kanäle
    ├── Rollen und Berechtigungen
    ├── Community-Funktionen
    ├── Moderation / AutoMod
    └── Webhooks / Apps
             │
             │ HTTPS
             ▼
Contabo VPS
└── Ubuntu
    ├── Docker
    └── Dokploy / Traefik
        ├── n8n
        ├── optionale Discord-Bot-Anwendung
        └── Monitoring / eigene Services
```

Wichtig:

- Der Discord-Server selbst läuft nicht auf Contabo.
- Für Discord wird keine Dokploy-Domain benötigt.
- Bots, Automationen und Webhook-Sender können auf dem Contabo-VPS betrieben werden.
- Discord-Tokens und Webhook-URLs gehören ausschließlich in Dokploy-Secrets bzw. geschützte Credential-Stores.
- Ein Discord-Bot benötigt nur dann einen öffentlichen Endpunkt, wenn die konkrete Integration eingehende HTTP-Requests oder Interactions über einen Webserver verarbeitet.

## Voraussetzungen

Benötigt werden:

- ein Discord-Konto,
- Discord Desktop-App oder Browser,
- Berechtigung zum Erstellen eines Servers,
- optional ein bestehender Contabo-VPS mit Ubuntu, Docker und Dokploy,
- optional n8n für Automationen,
- optional ein eigener Discord-Bot.

Für einen öffentlich wachsenden Server sollte zusätzlich Zeit für Moderation, Rollenpflege und Regeln eingeplant werden.

## Discord-Server erstellen

In Discord:

1. In der linken Serverleiste **Server hinzufügen** wählen.
2. **Eigenen Server erstellen** oder eine Vorlage auswählen.
3. Je nach Einsatzzweck **Für einen Club oder eine Community** oder eine private Variante wählen.
4. Servernamen vergeben.
5. Optional ein Server-Icon hinterlegen.
6. Server erstellen.

Discord beschreibt Server als anpassbare digitale Räume für Communities, Freundesgruppen und gemeinsame Interessen.

## Grundstruktur planen

Beispiel:

```text
INFORMATION
├── #willkommen
├── #regeln
├── #ankuendigungen
└── #faq

COMMUNITY
├── #allgemein
├── #projekte
├── #hilfe
└── 🔊 Lounge

TECHNIK
├── #server-status
├── #deployments
├── #github
└── #automation

TEAM
├── #moderation
├── #admin
└── 🔊 Team
```

Für kleine Server reichen oft deutlich weniger Kanäle. Neue Bereiche sollten erst angelegt werden, wenn tatsächlich Bedarf besteht.

## Rollenmodell

Discord-Berechtigungen basieren auf Rollen. Die Rollenhierarchie ist von oben nach unten aufgebaut.

Empfohlenes Grundmodell:

```text
Owner
Administrator
Moderator
Automation
Mitglied
Gast
@everyone
```

Die Berechtigung **Administrator** gewährt praktisch vollständige Serverrechte und umgeht Kanalbeschränkungen. Sie sollte nur sehr wenigen vertrauenswürdigen Personen oder Anwendungen zugewiesen werden.

Für Bots empfiehlt sich eine eigene Rolle wie `Automation`, die nur die tatsächlich benötigten Berechtigungen erhält.

Beispiel für einen reinen Benachrichtigungs-Bot:

```text
Kanäle anzeigen
Nachrichten senden
Links einbetten
Dateien anhängen
```

Keine Administrator-Berechtigung.

## Berechtigungen richtig einsetzen

Discord kennt Berechtigungen auf Server-, Kategorie- und Kanalebene. Kanal- und Kategorieberechtigungen können serverweite Rollenrechte überschreiben.

Empfehlung:

1. Grundrechte über Rollen vergeben.
2. Kategorien verwenden, um Gruppen von Kanälen einheitlich abzusichern.
3. Einzelne Kanal-Ausnahmen sparsam einsetzen.
4. Administratorrechte nur vergeben, wenn technisch notwendig.

Beispiel für den privaten Team-Bereich:

```text
Kategorie: TEAM

@everyone
→ Kanal anzeigen: Nein

Moderator
→ Kanal anzeigen: Ja

Administrator
→ Kanal anzeigen: Ja
```

## Community-Modus aktivieren

Für öffentliche oder größere Server empfiehlt sich der Community-Modus.

```text
Servereinstellungen
→ Community aktivieren
```

Discord verlangt für Community-Server unter anderem klare Regeln und grundlegende Sicherheitsmaßnahmen. Der Community-Modus bietet zusätzliche Werkzeuge für Moderation, Regeln, Ankündigungen und Onboarding.

## Regeln erstellen

Beispiel:

```text
1. Respektvoll miteinander umgehen.
2. Kein Spam oder Flooding.
3. Keine rechtswidrigen Inhalte.
4. Keine Zugangsdaten, API-Keys oder vertraulichen Daten posten.
5. Themenbezogene Kanäle verwenden.
6. Moderationsentscheidungen nicht öffentlich eskalieren.
7. Discord Community Guidelines beachten.
```

Für eine Tech-Community zusätzlich sinnvoll:

```text
Keine Passwörter
Keine privaten SSH-Keys
Keine vollständigen .env-Dateien
Keine Produktions-API-Keys
Keine Tokens
```

## Verifizierungsstufe konfigurieren

Discord stellt mehrere Verifizierungsstufen bereit. Sie bestimmen, welche Voraussetzungen ein Mitglied erfüllen muss, bevor es Nachrichten senden kann.

Für öffentliche Server sollte eine angemessene Verifizierungsstufe aktiviert werden.

```text
Servereinstellungen
→ Sicherheit / Moderation
→ Verifizierungsstufe
```

Je öffentlicher und größer der Server ist, desto restriktiver sollte die Einstellung gewählt werden.

## AutoMod und Moderation

Bei Community-Servern sollten die eingebauten Moderationsmöglichkeiten genutzt werden.

Typische Regeln:

- Spam reduzieren,
- problematische Begriffe filtern,
- Mention-Spam begrenzen,
- unerwünschte Links kontrollieren.

AutoMod ersetzt kein Moderatorenteam, reduziert aber Routinearbeit.

## Onboarding

Community-Onboarding kann neuen Mitgliedern helfen, relevante Rollen und Kanäle auszuwählen.

Beispiel:

```text
Frage:
Wofür interessierst du dich?

Antworten:
- Docker & DevOps
- Automatisierung
- AI / LLM
- Webentwicklung
- Server & Hosting
```

## Webhooks

Discord-Webhooks sind eine einfache Möglichkeit, Nachrichten automatisiert in einen Kanal zu senden.

```text
Servereinstellungen
→ Integrationen
→ Webhooks
→ Neuer Webhook
```

Konfigurieren:

- Name,
- Zielkanal,
- optional Avatar.

Danach erzeugt Discord eine geheime Webhook-URL. Diese URL ist ein Credential und darf nicht in Git oder öffentliche Dokumentation gelangen.

In Dokploy wird sie als Secret hinterlegt:

```text
DISCORD_WEBHOOK_URL=...
```

## Contabo-/Dokploy-Integration

Die bestehende Infrastruktur kann Discord-Nachrichten senden:

```text
Contabo VPS
└── Dokploy
    ├── n8n
    ├── Monitoring
    ├── eigene Apps
    └── CI-/Deployment-Helfer
             │
             ▼
      Discord Webhook
             │
             ▼
      #server-status
```

Für einen Webhook-Sender ist normalerweise keine eingehende öffentliche Domain erforderlich. Der Container benötigt lediglich ausgehenden HTTPS-Zugriff zu Discord.

## Beispiel: Discord-Meldung mit curl

Webhook-URL als Environment-Variable:

```bash
export DISCORD_WEBHOOK_URL="..."
```

Nachricht:

```bash
curl \
  -H "Content-Type: application/json" \
  -d '{"content":"TechWissen Deployment erfolgreich."}' \
  "$DISCORD_WEBHOOK_URL"
```

Keine Webhook-URL direkt in Scripts committen.

## Discord mit n8n verwenden

Ist n8n bereits über Dokploy eingerichtet, eignet es sich sehr gut für Discord-Automationen.

```text
Schedule Trigger
      │
      ▼
HTTP Request / Monitoring
      │
      ▼
IF
      │
      ▼
Discord Webhook
```

Mögliche Anwendungsfälle:

- täglicher Serverstatus,
- fehlgeschlagene Backups,
- neue GitHub-Releases,
- Deployment-Status,
- neue TechWissen-Artikel,
- Erinnerungen,
- AI-Zusammenfassungen mit Ollama.

## Optional: eigener Discord-Bot

Für komplexere Interaktionen empfiehlt sich eine Discord Application mit Bot.

Im Discord Developer Portal:

```text
Applications
→ New Application
→ Bot
```

Das Bot-Token ist ein Secret und darf niemals veröffentlicht werden.

Auf dem Contabo-VPS kann die Architektur so aussehen:

```text
Discord
   │
   │ Discord Gateway / API
   ▼
Discord-Bot
Docker Container
   │
   ├── interne APIs
   ├── PostgreSQL
   ├── Ollama
   └── n8n
```

Ein klassischer Gateway-Bot benötigt normalerweise kein öffentliches Host-Port-Mapping.

## Bot-Berechtigungen

Bots sollten nach dem Least-Privilege-Prinzip arbeiten.

Nicht standardmäßig:

```text
Administrator
```

Beispiel Benachrichtigungs-Bot:

```text
View Channels
Send Messages
Embed Links
Attach Files
```

## Discord-Tokens in Dokploy

Beispiel:

```env
DISCORD_BOT_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=...
```

Diese Werte werden als Dokploy Environment/Secrets hinterlegt und nicht in Dockerfile, Compose-Datei oder Git gespeichert.

## Deployment in Dokploy

Der Discord-Server selbst wird nicht über Dokploy deployt. Nur optionale Integrationen werden dort betrieben.

Beispiel Bot:

```yaml
services:
  discord-bot:
    image: ghcr.io/example/discord-bot:latest
    restart: unless-stopped

    environment:
      DISCORD_BOT_TOKEN: ${DISCORD_BOT_TOKEN:?required}

    networks:
      - bot-egress

networks:
  bot-egress:
    driver: bridge
```

Kein `ports:`-Mapping konfigurieren, wenn der Bot keinen eingehenden HTTP-Dienst benötigt.

## Deployment prüfen

Für einen einfachen Webhook:

```bash
curl \
  -H "Content-Type: application/json" \
  -d '{"content":"Discord-Integration funktioniert."}' \
  "$DISCORD_WEBHOOK_URL"
```

Danach den Zielkanal kontrollieren.

Bei einem Bot:

```bash
docker compose logs -f discord-bot
```

Zusätzlich prüfen:

- Bot ist im Server sichtbar.
- Bot besitzt nur notwendige Rollen.
- gewünschter Kanal ist erreichbar.
- Nachrichten werden korrekt gesendet.
- Secrets erscheinen nicht in Logs.

## Funktionstest

| Test | Erwartung |
|---|---|
| normales Mitglied schreibt in `#allgemein` | erlaubt |
| normales Mitglied öffnet `#admin` | nicht erlaubt |
| Moderator öffnet Moderationskanal | erlaubt |
| Bot schreibt in Statuskanal | erlaubt |
| Webhook sendet Testmeldung | Nachricht erscheint |
| neuer Nutzer ohne nötige Verifizierung | eingeschränkt |

## Sicherheitskonzept

### Administrator sparsam vergeben

Die Discord-Administratorberechtigung umgeht Kanalbeschränkungen. Nur Personen oder Anwendungen, die tatsächlich vollständigen Zugriff benötigen, sollten sie erhalten.

### Bot-Tokens geheim halten

Bei Verdacht auf Kompromittierung:

1. Token im Developer Portal regenerieren.
2. Dokploy-Secret aktualisieren.
3. Bot redeployen.
4. Logs und Rollen prüfen.

### Webhook-URLs wie Passwörter behandeln

Wer die Webhook-URL kennt, kann den Webhook verwenden. Bei Veröffentlichung sollte der Webhook ersetzt und das Secret aktualisiert werden.

### @everyone minimal halten

`@everyone` sollte nur die allgemein erforderlichen Rechte erhalten. Zusätzliche Berechtigungen über Rollen vergeben.

### Rollen-Hierarchie prüfen

Bots können nur Rollen und Mitglieder verwalten, die unter ihrer höchsten Rolle stehen. Die Bot-Rolle sollte daher nur so hoch platziert werden wie nötig.

### Zwei-Faktor-Authentifizierung

Für Owner und Administratoren sollte 2FA verwendet werden.

## Logs

Discord besitzt ein Audit Log für administrative Aktionen:

```text
Servereinstellungen
→ Audit Log
```

Für eigene Bots zusätzlich Docker-/Dokploy-Logs verwenden. Keine Tokens oder Webhook-URLs loggen.

## Healthcheck

Der Discord-Server selbst wird von Discord betrieben. Für eigene Integrationen sollte aber deren Zustand überwacht werden.

Beispiele:

```text
Bot-Prozess läuft
Discord API erreichbar
letzte erfolgreiche Nachricht
Fehlerrate
Restart-Anzahl
```

## Backups

Discord selbst wird nicht über dein Contabo-Backup gesichert.

Für die eigene Infrastruktur sichern:

- Bot-Quellcode,
- Bot-Datenbank,
- n8n-Workflows und Credentials entsprechend dem n8n-Backupkonzept,
- Konfigurationsdokumentation,
- Rollen-/Kanal-Konzept.

Secrets nicht unverschlüsselt in Dokumentationsbackups ablegen.

## Updates

Discord selbst wird als Plattform von Discord aktualisiert. Eigene Komponenten müssen separat gepflegt werden:

```text
Discord Bot
n8n
Docker Images
Node.js/Python Libraries
Monitoring
```

## Troubleshooting

### Webhook sendet nichts

Prüfen:

- Webhook noch vorhanden?
- Zielkanal vorhanden?
- URL vollständig?
- Internetzugriff aus Container möglich?
- HTTP-Status der Anfrage?

### Bot ist offline

Prüfen:

```text
Dokploy Logs
Containerstatus
Bot-Token
Netzwerkzugriff
Discord Developer Portal
```

### Bot kann nicht schreiben

Prüfen:

- Bot-Rolle,
- Kanalberechtigungen,
- Kategorie-Berechtigungen,
- Rollenhierarchie.

### Mitglieder sehen falsche Kanäle

Prüfen:

```text
@everyone
Rollenrechte
Kategorie-Overrides
Kanal-Overrides
```

## Produktionscheckliste

- [ ] Servername und Icon gesetzt
- [ ] Informationskanäle vorhanden
- [ ] Regelkanal eingerichtet
- [ ] Rollenmodell definiert
- [ ] Administrator nur minimal vergeben
- [ ] Moderatorrolle getestet
- [ ] `@everyone` geprüft
- [ ] private Kategorien getestet
- [ ] Verifizierungsstufe konfiguriert
- [ ] Community-Modus bei öffentlichen Servern aktiviert
- [ ] AutoMod bzw. Moderationsregeln geprüft
- [ ] Einladungslinks geprüft
- [ ] 2FA für Admins aktiviert
- [ ] Webhook-URLs nicht in Git
- [ ] Bot-Tokens ausschließlich als Secrets
- [ ] Bots ohne unnötige Administratorrechte
- [ ] Audit Log bekannt und geprüft
- [ ] optionale n8n-/Dokploy-Integration getestet

## Empfohlene endgültige Architektur

```text
Discord Cloud
└── Tech-Community
    ├── Information
    ├── Community
    ├── Technik
    ├── Team
    ├── Rollen
    ├── AutoMod
    └── Integrationen
          │
          ├── Webhooks
          │
          └── Bot/API
                │
                ▼
Contabo VPS
└── Ubuntu + Docker + Dokploy
    ├── n8n
    ├── Discord Bot optional
    ├── Monitoring
    ├── Ollama optional
    └── weitere interne Services
```

Discord übernimmt dabei die Kommunikationsplattform. Der Contabo-VPS übernimmt ausschließlich selbst kontrollierte Automationen und Integrationen.

## Quellen

- Discord Server Setup Guide: https://support.discord.com/hc/de/articles/33023827550359-Discord-Server-Setup-Anleitung
- Discord Permissions Setup FAQ: https://support.discord.com/hc/de/articles/206029707-FAQ-zur-Einrichtung-von-Berechtigungen
- Discord Roles and Permissions: https://support.discord.com/hc/de/articles/214836687-Discord-Rollen-und-Berechtigungen
- Discord Verification Levels: https://support.discord.com/hc/de/articles/216679607-Verifizierungsstufen
- Discord Community Server Guidelines: https://support.discord.com/hc/de/articles/360035969312-Community-Server-Richtlinien
- Discord Community Server Setup: https://support.discord.com/hc/de/articles/360047132851-Richte-deinen-Community-Server-ein
- Discord Community Onboarding FAQ: https://support.discord.com/hc/de/articles/11074987197975-Community-Onboarding-FAQ-H%C3%A4ufig-gestellte-Fragen
- Discord Webhooks: https://support.discord.com/hc/de/articles/228383668-Einf%C3%BChrung-in-Webhooks
- Discord Developer Portal: https://discord.com/developers/applications
