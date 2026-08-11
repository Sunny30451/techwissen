# TechWissen Markdown-Upload – Validierungsregeln

Der Adminbereich akzeptiert beim Erstellen eines **neuen Artikels** eine `.md`-Datei als Ausgangsbasis.

## Harte Validierung

Der Upload wird nur als gültige TechWissen-Vorlage markiert, wenn:

- die Datei auf `.md` endet,
- die Dateigröße innerhalb von `ARTICLE_MARKDOWN_MAX_MB` liegt,
- der Inhalt gültiges UTF-8 ist,
- die erste inhaltliche Zeile ein H1-Titel `# Titel` ist,
- genau eine H1-Überschrift vorhanden ist,
- keine nicht ersetzten Template-Platzhalter `{{...}}` enthalten sind,
- dreifache Backtick-Codeblöcke paarig geöffnet/geschlossen sind,
- folgende Pflichtabschnitte vorhanden sind:
  - `## Zielarchitektur`
  - `## Voraussetzungen`
  - `## Deployment in Dokploy`
  - `## Deployment prüfen`
  - `## Sicherheitskonzept`
  - `## Produktionscheckliste`
  - `## Quellen`

## Hinweise

Fehlende empfohlene Abschnitte blockieren den Import nicht, werden aber im Adminbereich als Hinweise angezeigt. Dazu gehören z. B. Repository-Aufbau, Secrets, Docker Compose, Environment, Funktionstest, Container-Integration, Logs, Healthcheck, Backups, Updates und endgültige Architektur.

## Was automatisch übernommen wird

Bei erfolgreicher Validierung werden in den Editor übernommen bzw. vorgeschlagen:

- Titel aus der H1,
- Markdown-Inhalt,
- erster geeigneter Einleitungsabsatz als Kurzbeschreibung,
- geschätzte Lesezeit.

Kategorie, Tags, Veröffentlichungsdatum, Repository-URL, Featured-Status und optionales Dokploy-ZIP werden weiterhin explizit im Adminformular gepflegt.
