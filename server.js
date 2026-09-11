import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const sessions = new Map();

const questions = [
  { question: 'Wie viele Kontinente gibt es?', answers: ['5', '6', '7', '8'], correct: 2 },
  { question: 'Welche Farbe entsteht aus Blau und Gelb?', answers: ['Grün', 'Orange', 'Lila', 'Rot'], correct: 0 },
  { question: 'Wie viele Sekunden hat eine Minute?', answers: ['30', '45', '60', '90'], correct: 2 }
];

function createCode() {
  let code;
  do code = String(Math.floor(100000 + Math.random() * 900000)); while (sessions.has(code));
  return code;
}

function publicState(session) {
  return {
    code: session.code,
    status: session.status,
    players: [...session.players.values()].map(({ id, username, score, answered }) => ({ id, username, score, answered })),
    currentQuestion: session.currentQuestion,
    totalQuestions: questions.length,
    question: session.status === 'playing' ? {
      text: questions[session.currentQuestion].question,
      answers: questions[session.currentQuestion].answers
    } : null
  };
}

function emitState(session) {
  io.to(session.code).emit('state', publicState(session));
}

io.on('connection', socket => {
  socket.on('host:create', (_, cb = () => {}) => {
    const code = createCode();
    const session = { code, hostId: socket.id, status: 'lobby', currentQuestion: 0, players: new Map() };
    sessions.set(code, session);
    socket.join(code);
    socket.data = { code, role: 'host' };
    cb({ ok: true, code, state: publicState(session) });
  });

  socket.on('player:join', ({ code, username }, cb = () => {}) => {
    code = String(code || '').trim();
    username = String(username || '').trim().slice(0, 24);
    const session = sessions.get(code);
    if (!session) return cb({ ok: false, error: 'Session nicht gefunden.' });
    if (session.status !== 'lobby') return cb({ ok: false, error: 'Das Spiel läuft bereits.' });
    if (!username) return cb({ ok: false, error: 'Bitte Username eingeben.' });
    if ([...session.players.values()].some(p => p.username.toLowerCase() === username.toLowerCase())) {
      return cb({ ok: false, error: 'Username bereits vergeben.' });
    }
    session.players.set(socket.id, { id: socket.id, username, score: 0, answered: false });
    socket.join(code);
    socket.data = { code, role: 'player' };
    cb({ ok: true, state: publicState(session) });
    emitState(session);
  });

  socket.on('host:start', ({ code }, cb = () => {}) => {
    const session = sessions.get(String(code));
    if (!session || session.hostId !== socket.id) return cb({ ok: false });
    if (!session.players.size) return cb({ ok: false, error: 'Mindestens ein Spieler muss beitreten.' });
    session.status = 'playing';
    session.currentQuestion = 0;
    for (const player of session.players.values()) player.answered = false;
    emitState(session);
    cb({ ok: true });
  });

  socket.on('player:answer', ({ code, answer }, cb = () => {}) => {
    const session = sessions.get(String(code));
    const player = session?.players.get(socket.id);
    if (!session || !player || session.status !== 'playing') return cb({ ok: false });
    if (player.answered) return cb({ ok: false, error: 'Du hast bereits geantwortet.' });
    const q = questions[session.currentQuestion];
    const answerIndex = Number(answer);
    player.answered = true;
    const correct = answerIndex === q.correct;
    if (correct) player.score += 100;
    cb({ ok: true, correct, correctAnswer: q.correct });
    emitState(session);
  });

  socket.on('host:next', ({ code }, cb = () => {}) => {
    const session = sessions.get(String(code));
    if (!session || session.hostId !== socket.id) return cb({ ok: false });
    if (session.currentQuestion >= questions.length - 1) {
      session.status = 'finished';
      emitState(session);
      return cb({ ok: true, finished: true });
    }
    session.currentQuestion += 1;
    for (const player of session.players.values()) player.answered = false;
    emitState(session);
    cb({ ok: true });
  });

  socket.on('disconnect', () => {
    const { code, role } = socket.data || {};
    const session = sessions.get(code);
    if (!session) return;
    if (role === 'host') {
      io.to(code).emit('session:closed');
      sessions.delete(code);
      return;
    }
    session.players.delete(socket.id);
    emitState(session);
  });
});

server.listen(PORT, () => console.log(`Geheimste Gewinnshow läuft auf Port ${PORT}`));
