const socket = io();
let role = null;
let code = null;
let state = null;
let locked = false;

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
  $('lobbyHint').textContent = role === 'host' ? 'Teile den Code mit allen Mitspielern.' : 'Warte, bis der Host das Spiel startet.';
  $('players').innerHTML = s.players.length
    ? s.players.map(p => `<div class="player"><span>${escapeHtml(p.username)}</span><strong>${p.score}</strong></div>`).join('')
    : '<p class="muted">Noch niemand beigetreten.</p>';
  $('startBtn').classList.toggle('hidden', role !== 'host');
  $('startBtn').disabled = s.players.length === 0;
}

function renderGame(s) {
  show('game');
  $('questionCount').textContent = `FRAGE ${s.currentQuestion + 1} / ${s.totalQuestions}`;
  $('questionText').textContent = s.question.text;
  const me = s.players.find(p => p.id === socket.id);
  $('score').textContent = role === 'player' && me ? `${me.score} Punkte` : `${s.players.length} Spieler`;
  $('answers').innerHTML = s.question.answers.map((a, i) => `<button class="answer" data-answer="${i}"><span>${String.fromCharCode(65+i)}</span>${escapeHtml(a)}</button>`).join('');

  if (role === 'player') {
    $('hostStatus').classList.add('hidden');
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
  } else {
    document.querySelectorAll('.answer').forEach(btn => btn.disabled = true);
    $('hostStatus').classList.remove('hidden');
    const answered = s.players.filter(p => p.answered).length;
    $('hostStatus').textContent = `${answered} / ${s.players.length} haben geantwortet`;
    $('nextBtn').classList.remove('hidden');
    $('nextBtn').textContent = s.currentQuestion === s.totalQuestions - 1 ? 'Ergebnis anzeigen' : 'Nächste Frage';
  }
}

function renderFinished(s) {
  show('finished');
  const sorted = [...s.players].sort((a,b) => b.score - a.score);
  $('ranking').innerHTML = sorted.map((p,i) => `<div class="rank"><span class="place">#${i+1}</span><span>${escapeHtml(p.username)}</span><strong>${p.score}</strong></div>`).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
