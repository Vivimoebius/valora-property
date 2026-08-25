# Valora Property Advisory — Website

Quellcode der Website **[valora-property.com](https://valora-property.com)** (Betreiberin: Vivian Möbius).
Statische Seite auf **Netlify**, DNS über **IONOS**, drei Sprachen (DE / EN / ES).

---

## Struktur

```
netlify.toml            Build-Config (publish = site/, Functions, Security-Header)
site/                   Die veröffentlichte Website (publish-Verzeichnis)
  index.html, faq.html, rechner.html, abrechnungstest.html, ...
  en/  es/              Englische / spanische Fassungen
  images/              Bilder, Videos, Audio
  netlify/functions/   Serverless-Funktionen
    analyze.js         KI-Auswertung des Abrechnungs-Schnelltests
    chat.js            KI-Chatbot (Chat-Widget)
tools/                  Hilfsskripte (Deploy)
```

## Der Abrechnungs-Schnelltest (Lead-Magnet)

Ablauf hinter `site/abrechnungstest.html`:

1. Kunde lädt PDF/Foto hoch **oder** fügt Text ein, gibt E-Mail an, willigt ein.
2. Der Browser bereitet die Datei auf (siehe Fix unten) und schickt **zwei** Requests:
   - **Lead:** `POST /` → Netlify-Formular `abrechnungstest` (Feld `email`, `lang`).
     Netlify sendet eine Benachrichtigung an **info@valora-property.com**.
   - **Analyse:** `POST /.netlify/functions/analyze` mit `{lang, email, text | fileBase64+mimeType}`.
3. `analyze.js` schickt die Abrechnung an **Google Gemini** (`gemini-2.5-flash-lite`,
   Fallback **TokenMix**) und liefert `{result}` zurück — Abschnitte: Überblick /
   auffällige Posten / Plausibilität / Empfehlungen, < 200 Wörter, kein verbindlicher Rechtsrat.
4. Ergebnis erscheint **sofort am Bildschirm**. **Keine dauerhafte Speicherung** von
   Abrechnung oder Ergebnis; gespeichert wird nur der Lead (E-Mail + Sprache).

> Der Kunde erhält **keine** E-Mail. Die einzige Mail (mit E-Mail + Sprache, ohne
> Dokument/Ergebnis) geht an info@valora-property.com.

**API-Keys** liegen als Netlify-Umgebungsvariablen (`GEMINI_API_KEY`, `TOKENMIX_API_KEY`) —
nicht im Code.

## Bugfix 25.08.2026 — Datei-Upload

**Problem:** Die Oberfläche erlaubte Dateien bis **8 MB**, aber der Analyse-Request
(Base64 im JSON-Body) sprengte Netlifys **~6 MB**-Limit → **HTTP 413** → generische
Fehlermeldung. Reale mehrseitige Scan-PDFs scheiterten stumm.

**Fix** (in `abrechnungstest.html` DE/EN/ES):
- Limit auf **4 MB** gesenkt (Label + Prüfung), da Base64 ~33 % aufbläht.
- **Bilder werden clientseitig verkleinert** (Canvas → JPEG), damit große Handyfotos
  weiterhin durchgehen und kein Lead verloren geht.
- **Statusabhängige Meldungen** (413 = zu groß, Timeout, sonstige Fehler) statt einer
  generischen Meldung; Fallback-Hinweise (Text einfügen / per Mail senden).

## Deploy

Voraussetzung: `netlify` CLI, eingeloggt im Team `info-fpj2zfg`, verlinkt mit der Site
`valora-property` (`61b47316-1197-44a2-aa0c-7d5e4aaace83`).

```bash
netlify link            # einmalig: mit der Site verbinden
netlify deploy          # Preview-Deploy (Test-URL) — erst hier prüfen!
netlify deploy --prod   # Live schalten
```

Alternativ steht in `tools/` ein Skript für einen **schonenden Teil-Deploy** über die
Netlify-Digest-API (ändert nur einzelne Dateien, lässt alles andere unangetastet) —
so wurde der obige Bugfix ausgeliefert.

## Hinweise

- **Medien** (Bilder/Videos) sind im Repo enthalten, damit die Seite vollständig
  deploybar ist.
- `site/netlify.toml` existiert im Live-Deploy, ist aber per API nicht als Rohinhalt
  exportierbar; die Build-Config im Repo-Root ist aus dem Live-Verhalten rekonstruiert
  (Header 1:1). Vor einem Voll-Redeploy bitte auf einer Preview verifizieren, dass
  Security-Header und die extensionslosen URLs (`/rechner`, `/faq`, …) korrekt sind.
