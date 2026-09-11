const socket = io();
let role = null;
let code = null;
let state = null;
let locked = false;
let draggedQueueId = null;

const $ = id => document.getElementById(id);
const screens = ['home','join','lobby','game','finished'];
function show(id){ screens.forEach(s => $(s).classList.toggle('hidden', s !== id)); }

$('joinOpenBtn').onclick = () => show('join');
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => show('home'));
$('reloadBtn').onclick = () => location.reload();

$('createBtn').onclick = () => {
  socket.emit('host:create', {}, res => {
    if (!res.ok) return;
    role = 'host'; code = res.code; state = res.state; render(state);
  });
};

$('joinBtn').onclick = () => {
  $('joinError').textContent = '';
  socket.emit('player:join', { code: $('codeInput').value, username: $('usernameInput').value }, res => {
    if (!res.ok) { $('joinError').textContent = res.error || 'Beitritt fehlgeschlagen.'; return; }
    role = 'player'; code = $('codeInput').value.trim(); state = res.state; render(state);
  });
};

$('startBtn').onclick = () => socket.emit('host:start', { code }, res => {
  if (!res.ok && res.error) alert(res.error);
});
$('nextBtn').onclick = () => socket.emit('host:next', { code });

$('saveSettingsBtn').onclick = () => {
  socket.emit('host:settings', {
    code,
    questionCount: Number($('questionCountInput').value),
    prizePool: Number($('prizePoolInput').value),
    questionDuration: Number($('questionDurationInput').value)
  }, res => {
    if (!res.ok) alert('Einstellungen konnten nicht gespeichert werden.');
  });
};

$('bankSearch').addEventListener('input', () => renderBank(state));
$('addCustomBtn').onclick = () => addCustom(false);
$('addLiveCustomBtn').onclick = () => addCustom(true);

socket.on('state', next => { state = next; locked = false; render(next); });
socket.on('session:closed', () => { alert('Der Host hat die Session beendet.'); location.reload(); });

function render(s) {
  if (!s) return;
  if (s.status === 'lobby') return renderLobby(s);
  if (s.status === 'playing') return renderGame(s);
  if (s.status === 'finished') return renderFinished(s);
}

function renderLobby(s) {
  show('lobby');
  $('sessionCode').textContent = s.code;
  $('lobbyTitle').textContent = role === 'host' ? 'Deine Arena ist bereit' : 'Du bist drin';
  $('lobbyHint').textContent = role === 'host' ? 'Baue dein Spiel zusammen und teile dann den Code.' : 'Warte, bis der Host das Spiel startet.';
  $('lobbyMoney').textContent = role === 'host' ? `${formatMoney(s.prizePool)} Spielgeld` : '';
  $('lobbyMoney').classList.toggle('hidden', role !== 'host');
  $('players').innerHTML = s.players.length
    ? s.players.map(p => `<div class="player"><span>#${p.rank} ${escapeHtml(p.username)}</span><strong>${p.score} P · ${formatMoney(p.money)}</strong></div>`).join('')
    : '<p class="muted">Noch niemand beigetreten.</p>';

  $('hostSetup').classList.toggle('hidden', role !== 'host');
  $('startBtn').classList.toggle('hidden', role !== 'host');
  $('startBtn').disabled = s.players.length === 0 || !s.queue?.length;

  if (role === 'host') {
    $('questionCountInput').value = s.configuredQuestionCount;
    $('prizePoolInput').value = s.prizePool;
    $('questionDurationInput').value = s.questionDuration;
    renderBank(s);
    renderQueue(s, 'questionQueue', true);
  }
}

function renderBank(s) {
  if (role !== 'host' || !s?.bank) return;
  const term = $('bankSearch').value.trim().toLowerCase();
  const items = s.bank.filter(q => !term || q.question.toLowerCase().includes(term));
  $('questionBank').innerHTML = items.map(q => `
    <div class="bankItem">
      <div><strong>${escapeHtml(q.question)}</strong><small>${escapeHtml(q.answers.join(' · '))}</small></div>
      <button class="miniBtn" data-add-default="${q.id}">+</button>
    </div>`).join('');
  document.querySelectorAll('[data-add-default]').forEach(btn => {
    btn.onclick = () => socket.emit('host:queue:addDefault', { code, questionId: btn.dataset.addDefault });
  });
}

function renderQueue(s, targetId, editable) {
  const target = $(targetId);
  if (!target || !s?.queue) return;
  const items = targetId === 'liveQueue' ? s.queue.slice(s.currentQuestion + 1) : s.queue;
  target.innerHTML = items.length ? items.map((q, idx) => `
    <div class="queueItem ${q.locked ? 'locked' : ''}" data-queue-id="${q.queueId}" draggable="${editable && !q.locked}">
      <span class="dragHandle">⋮⋮</span>
      <span class="queueNumber">${targetId === 'liveQueue' ? s.currentQuestion + idx + 2 : q.index + 1}</span>
      <div><strong>${escapeHtml(q.question)}</strong><small>${q.source === 'custom' ? 'CUSTOM' : 'DEFAULT'}</small></div>
      ${editable && !q.locked ? `<button class="iconBtn" data-remove="${q.queueId}">×</button>` : ''}
    </div>`).join('') : '<p class="muted">Keine weiteren Fragen.</p>';

  if (!editable) return;
  target.querySelectorAll('[data-remove]').forEach(btn => btn.onclick = () => socket.emit('host:queue:remove', { code, queueId: btn.dataset.remove }, res => {
    if (!res.ok && res.error) alert(res.error);
  }));

  target.querySelectorAll('.queueItem[draggable="true"]').forEach(item => {
    item.addEventListener('dragstart', () => { draggedQueueId = item.dataset.queueId; item.classList.add('dragging'); });
    item.addEventListener('dragend', () => { draggedQueueId = null; item.classList.remove('dragging'); });
    item.addEventListener('dragover', event => event.preventDefault());
    item.addEventListener('drop', event => {
      event.preventDefault();
      if (!draggedQueueId || draggedQueueId === item.dataset.queueId) return;
      const movable = s.queue.filter(q => !q.locked).map(q => q.queueId);
      const from = movable.indexOf(draggedQueueId);
      const to = movable.indexOf(item.dataset.queueId);
      if (from < 0 || to < 0) return;
      movable.splice(to, 0, movable.splice(from, 1)[0]);
      socket.emit('host:queue:reorder', { code, queueIds: movable }, res => {
        if (!res.ok && res.error) alert(res.error);
      });
    });
  });
}

function renderGame(s) {
  show('game');
  $('questionCount').textContent = `FRAGE ${s.currentQuestion + 1} / ${s.totalQuestions} · ${s.questionDuration}s`;
  $('questionText').textContent = s.question.text;
  const me = s.players.find(p => p.id === socket.id);
  $('score').textContent = role === 'player' && me ? `${me.score} P · ${formatMoney(me.money)}` : `${s.players.length} Spieler · ${formatMoney(s.prizePool)}`;
  $('answers').innerHTML = s.question.answers.map((a, i) => `<button class="answer" data-answer="${i}"><span>${String.fromCharCode(65+i)}</span>${escapeHtml(a)}</button>`).join('');

  if (role === 'player') {
    $('hostStatus').classList.add('hidden');
    $('hostLiveDeck').classList.add('hidden');
    $('nextBtn').classList.add('hidden');
    document.querySelectorAll('.answer').forEach(btn => {
      btn.disabled = !!me?.answered || locked;
      btn.onclick = () => {
        if (locked || me?.answered) return;
        locked = true;
        document.querySelectorAll('.answer').forEach(b => b.disabled = true);
        socket.emit('player:answer', { code, answer: Number(btn.dataset.answer) }, res => {
          if (!res.ok) { locked = false; return; }
          btn.classList.add(res.correct ? 'correct' : 'wrong');
          if (!res.correct) document.querySelector(`.answer[data-answer="${res.correctAnswer}"]`)?.classList.add('correct');
        });
      };
    });
    return;
  }

  document.querySelectorAll('.answer').forEach(btn => btn.disabled = true);
  $('hostLiveDeck').classList.remove('hidden');
  $('hostStatus').classList.remove('hidden');
  const answered = s.players.filter(p => p.answered).length;
  $('hostStatus').textContent = `${answered} / ${s.players.length} haben geantwortet`;
  $('nextBtn').classList.remove('hidden');
  $('nextBtn').textContent = s.currentQuestion === s.totalQuestions - 1 ? 'Ergebnis anzeigen' : 'Nächste Frage';

  $('liveLeaderboard').innerHTML = s.players.map(p => `
    <div class="leaderRow">
      <span class="rankBadge">#${p.rank}</span>
      <div><strong>${escapeHtml(p.username)}</strong><small>${p.score} Punkte · ${formatMoney(p.money)}</small></div>
      <span class="answerBadge ${p.answered ? (p.answerCorrect ? 'isCorrect' : 'isWrong') : ''}">${p.answered ? `${p.answerLabel} ${p.answerCorrect ? '✓' : '✕'}` : '—'}</span>
    </div>`).join('');
  renderQueue(s, 'liveQueue', false);
}

function addCustom(live) {
  const prefix = live ? 'liveCustom' : 'custom';
  const payload = {
    code,
    question: $(`${prefix}Question`).value,
    answers: ['A','B','C','D'].map(letter => $(`${prefix}${letter}`).value),
    correct: Number($(`${prefix}Correct`).value),
    ...(live ? { at: state.currentQuestion + 1 } : {})
  };
  socket.emit('host:queue:addCustom', payload, res => {
    if (!res.ok) return alert(res.error || 'Custom-Frage konnte nicht hinzugefügt werden.');
    $(`${prefix}Question`).value = '';
    ['A','B','C','D'].forEach(letter => $(`${prefix}${letter}`).value = '');
  });
}

function renderFinished(s) {
  show('finished');
  $('ranking').innerHTML = [...s.players].sort((a,b) => a.rank - b.rank).map(p => `
    <div class="rank"><span class="place">#${p.rank}</span><span>${escapeHtml(p.username)}</span><strong>${p.score} P · ${formatMoney(p.money)}</strong></div>`).join('');
}

function formatMoney(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
