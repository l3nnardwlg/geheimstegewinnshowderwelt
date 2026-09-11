# Die geheimste Gewinnshow der Welt

Kleine selbstgehostete Live-Quiz-Arena im Stil einer Gameshow.

## Features

- Host erstellt eine neue Session mit eindeutigem 6-stelligem Code
- Teilnehmer treten ohne Account nur mit Code + Username bei
- Live-Lobby mit Teilnehmerliste
- Host startet das Spiel und steuert den Fragenwechsel
- Fragen mit jeweils vier Antwortmöglichkeiten
- Antworten werden in Echtzeit synchronisiert
- 100 Punkte pro richtiger Antwort
- Finale Rangliste
- Responsive UI für Handy, Tablet und Desktop
- Docker-ready

## Start mit Docker Compose

```bash
docker compose up -d --build
```

Danach läuft die App standardmäßig auf:

```text
http://localhost:3000
```

## Lokal starten

Benötigt Node.js 20 oder neuer.

```bash
npm install
npm start
```

## Spielablauf

1. Host öffnet die Website und klickt auf **Session hosten**.
2. Die App erzeugt einen sechsstelligen Code.
3. Spieler klicken auf **Session beitreten** und geben Code + Username ein.
4. Der Host sieht alle Spieler live in der Lobby und startet das Spiel.
5. Spieler beantworten jede Frage über vier Antwortbuttons.
6. Der Host sieht, wie viele bereits geantwortet haben, und wechselt zur nächsten Frage.
7. Nach der letzten Frage erscheint das Ranking.

## Fragen ändern

Die Beispiel-Fragen liegen aktuell direkt in `server.js` im Array `questions`. Das ist bewusst simpel für das erste MVP. Als nächster Schritt kann daraus ein Host-Editor bzw. persistentes Fragen-Set werden.

## Architektur

- Node.js
- Express
- Socket.IO
- Vanilla HTML/CSS/JavaScript
- Docker / Docker Compose

Sessions werden aktuell nur im Arbeitsspeicher gehalten. Ein Neustart des Containers beendet daher laufende Sessions.
