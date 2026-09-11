import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { questionBank } from './questions.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const sessions = new Map();
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));

function createCode() {
  let code;
  do code = String(Math.floor(100000 + Math.random() * 900000)); while (sessions.has(code));
  return code;
}

function queueItem(question, suffix = crypto.randomUUID()) {
  return { ...question, queueId: `${question.id}-${suffix}` };
}

function createDefaultQueue(count) {
  return questionBank.slice(0, count).map(q => queueItem(q));
}

function rankedPlayers(session, includeAnswers = false) {
  const sorted = [...session.players.values()]
    .sort((a, b) => b.score - a.score || b.money - a.money || a.username.localeCompare(b.username));

  return sorted.map((player, index) => ({
    id: player.id,
    username: player.username,
    score: player.score,
    money: player.money,
    answered: player.answered,
    rank: index + 1,
    ...(includeAnswers ? {
      answerIndex: player.answerIndex,
      answerLabel: Number.isInteger(player.answerIndex) ? String.fromCharCode(65 + player.answerIndex) : null,
      answerCorrect: player.answerCorrect,
      answeredAt: player.answeredAt
    } : {})
  }));
}

function baseState(session) {
  const active = session.questionQueue[session.currentQuestion];
  return {
    code: session.code,
    status: session.status,
    currentQuestion: session.currentQuestion,
    totalQuestions: session.questionQueue.length,
    configuredQuestionCount: session.settings.questionCount,
    prizePool: session.settings.prizePool,
    questionDuration: session.settings.questionDuration,
    questionStartedAt: session.questionStartedAt,
    question: session.status === 'playing' && active ? {
      queueId: active.queueId,
      text: active.question,
      answers: active.answers
    } : null
  };
}

function playerState(session) {
  return {
    ...baseState(session),
    players: rankedPlayers(session, false)
  };
}

function hostState(session) {
  return {
    ...baseState(session),
    players: rankedPlayers(session, true),
    queue: session.questionQueue.map((q, index) => ({
      queueId: q.queueId,
      id: q.id,
      source: q.source,
      question: q.question,
      answers: q.answers,
      correct: q.correct,
      index,
      locked: session.status === 'playing' && index <= session.currentQuestion
    })),
    bank: questionBank.map(q => ({
      id: q.id,
      question: q.question,
      answers: q.answers,
      correct: q.correct,
      source: q.source
    }))
  };
}

function emitState(session) {
  if (session.hostId) io.to(session.hostId).emit('state', hostState(session));
  for (const player of session.players.values()) io.to(player.id).emit('state', playerState(session));
}

function resetRoundAnswers(session) {
  for (const player of session.players.values()) {
    player.answered = false;
    player.answerIndex = null;
    player.answerCorrect = null;
    player.answeredAt = null;
  }
}

function ensureQueueLength(session) {
  const target = session.settings.questionCount;
  if (session.questionQueue.length > target && session.status === 'lobby') {
    session.questionQueue = session.questionQueue.slice(0, target);
  }
  while (session.questionQueue.length < target) {
    const next = questionBank.find(q => !session.questionQueue.some(item => item.id === q.id));
    if (!next) break;
    session.questionQueue.push(queueItem(next));
  }
}

function getHostSession(socket, code) {
  const session = sessions.get(String(code));
  return session && session.hostId === socket.id ? session : null;
}

io.on('connection', socket => {
  socket.on('host:create', (_, cb = () => {}) => {
    const code = createCode();
    const settings = { questionCount: 20, prizePool: 100000, questionDuration: 30 };
    const session = {
      code,
      hostId: socket.id,
      status: 'lobby',
      currentQuestion: 0,
      questionStartedAt: null,
      settings,
      questionQueue: createDefaultQueue(settings.questionCount),
      players: new Map()
    };
    sessions.set(code, session);
    socket.join(code);
    socket.data = { code, role: 'host' };
    cb({ ok: true, code, state: hostState(session) });
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
    session.players.set(socket.id, {
      id: socket.id,
      username,
      score: 0,
      money: 0,
      answered: false,
      answerIndex: null,
      answerCorrect: null,
      answeredAt: null
    });
    socket.join(code);
    socket.data = { code, role: 'player' };
    cb({ ok: true, state: playerState(session) });
    emitState(session);
  });

  socket.on('host:settings', ({ code, questionCount, prizePool, questionDuration }, cb = () => {}) => {
    const session = getHostSession(socket, code);
    if (!session) return cb({ ok: false });
    session.settings.questionCount = clamp(questionCount, 1, 100);
    session.settings.prizePool = clamp(prizePool, 0, 1000000000);
    session.settings.questionDuration = clamp(questionDuration, 5, 300);
    if (session.status === 'lobby') ensureQueueLength(session);
    emitState(session);
    cb({ ok: true });
  });

  socket.on('host:queue:addDefault', ({ code, questionId, at }, cb = () => {}) => {
    const session = getHostSession(socket, code);
    const question = questionBank.find(q => q.id === questionId);
    if (!session || !question) return cb({ ok: false });
    const minIndex = session.status === 'playing' ? session.currentQuestion + 1 : 0;
    const index = clamp(at ?? session.questionQueue.length, minIndex, session.questionQueue.length);
    session.questionQueue.splice(index, 0, queueItem(question));
    session.settings.questionCount = session.questionQueue.length;
    emitState(session);
    cb({ ok: true });
  });

  socket.on('host:queue:addCustom', ({ code, question, answers, correct, at }, cb = () => {}) => {
    const session = getHostSession(socket, code);
    const cleanQuestion = String(question || '').trim().slice(0, 300);
    const cleanAnswers = Array.isArray(answers) ? answers.slice(0, 4).map(a => String(a || '').trim().slice(0, 160)) : [];
    const correctIndex = Number(correct);
    if (!session) return cb({ ok: false });
    if (!cleanQuestion || cleanAnswers.length !== 4 || cleanAnswers.some(a => !a) || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      return cb({ ok: false, error: 'Frage, vier Antworten und richtige Antwort werden benötigt.' });
    }
    const custom = {
      id: `custom-${crypto.randomUUID()}`,
      question: cleanQuestion,
      answers: cleanAnswers,
      correct: correctIndex,
      source: 'custom'
    };
    const minIndex = session.status === 'playing' ? session.currentQuestion + 1 : 0;
    const index = clamp(at ?? session.questionQueue.length, minIndex, session.questionQueue.length);
    session.questionQueue.splice(index, 0, queueItem(custom));
    session.settings.questionCount = session.questionQueue.length;
    emitState(session);
    cb({ ok: true });
  });

  socket.on('host:queue:remove', ({ code, queueId }, cb = () => {}) => {
    const session = getHostSession(socket, code);
    if (!session) return cb({ ok: false });
    const index = session.questionQueue.findIndex(q => q.queueId === queueId);
    if (index < 0) return cb({ ok: false });
    if (session.status === 'playing' && index <= session.currentQuestion) return cb({ ok: false, error: 'Bereits gespielte Fragen sind gesperrt.' });
    session.questionQueue.splice(index, 1);
    session.settings.questionCount = session.questionQueue.length;
    emitState(session);
    cb({ ok: true });
  });

  socket.on('host:queue:reorder', ({ code, queueIds }, cb = () => {}) => {
    const session = getHostSession(socket, code);
    if (!session || !Array.isArray(queueIds)) return cb({ ok: false });
    const lockedCount = session.status === 'playing' ? session.currentQuestion + 1 : 0;
    const locked = session.questionQueue.slice(0, lockedCount);
    const movable = new Map(session.questionQueue.slice(lockedCount).map(q => [q.queueId, q]));
    const reordered = queueIds.map(id => movable.get(id)).filter(Boolean);
    if (reordered.length !== movable.size) return cb({ ok: false, error: 'Queue ist nicht vollständig.' });
    session.questionQueue = [...locked, ...reordered];
    emitState(session);
    cb({ ok: true });
  });

  socket.on('host:start', ({ code }, cb = () => {}) => {
    const session = getHostSession(socket, code);
    if (!session) return cb({ ok: false });
    if (!session.players.size) return cb({ ok: false, error: 'Mindestens ein Spieler muss beitreten.' });
    if (!session.questionQueue.length) return cb({ ok: false, error: 'Die Fragen-Queue ist leer.' });
    session.status = 'playing';
    session.currentQuestion = 0;
    session.questionStartedAt = Date.now();
    resetRoundAnswers(session);
    emitState(session);
    cb({ ok: true });
  });

  socket.on('player:answer', ({ code, answer }, cb = () => {}) => {
    const session = sessions.get(String(code));
    const player = session?.players.get(socket.id);
    if (!session || !player || session.status !== 'playing') return cb({ ok: false });
    if (player.answered) return cb({ ok: false, error: 'Du hast bereits geantwortet.' });
    const q = session.questionQueue[session.currentQuestion];
    const answerIndex = Number(answer);
    if (!q || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) return cb({ ok: false });

    player.answered = true;
    player.answerIndex = answerIndex;
    player.answeredAt = Date.now();
    player.answerCorrect = answerIndex === q.correct;
    if (player.answerCorrect) {
      player.score += 100;
      player.money += Math.round(session.settings.prizePool / Math.max(1, session.questionQueue.length));
    }
    cb({ ok: true, correct: player.answerCorrect, correctAnswer: q.correct });
    emitState(session);
  });

  socket.on('host:next', ({ code }, cb = () => {}) => {
    const session = getHostSession(socket, code);
    if (!session) return cb({ ok: false });
    if (session.currentQuestion >= session.questionQueue.length - 1) {
      session.status = 'finished';
      session.questionStartedAt = null;
      emitState(session);
      return cb({ ok: true, finished: true });
    }
    session.currentQuestion += 1;
    session.questionStartedAt = Date.now();
    resetRoundAnswers(session);
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
