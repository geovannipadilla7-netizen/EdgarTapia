(() => {
  const SIZE = 4;
  const STORAGE_KEY = "arcade_shelf_2048_best";

  const gridEl = document.getElementById("grid");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const undoBtn = document.getElementById("undoBtn");
  const newBtn = document.getElementById("newBtn");
  const soundBtn = document.getElementById("soundBtn");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayDesc = document.getElementById("overlayDesc");
  const continueBtn = document.getElementById("continueBtn");
  const restartBtn = document.getElementById("restartBtn");

  let audioCtx = null;
  let soundOn = true;
  let board = [];
  let score = 0;
  let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
  let prevSnapshot = null;
  let wonOnce = false;
  let gameOver = false;
  let touchStart = null;

  bestEl.textContent = String(best);

  function playTone(freq, dur = 0.06, vol = 0.05) {
    if (!soundOn) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch (_) {
      // ignore
    }
  }

  function cloneBoard(b) {
    return b.map((row) => [...row]);
  }

  function addRandomTile() {
    const empty = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) empty.push([r, c]);
      }
    }
    if (!empty.length) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    board[r][c] = Math.random() < 0.9 ? 2 : 4;
    return `${r}-${c}`;
  }

  function render(popKey = null) {
    gridEl.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const val = board[r][c];
        const cell = document.createElement("div");
        const valClass = val === 0 ? "" : val <= 2048 ? `v-${val}` : "v-high";
        cell.className = `cell ${valClass}${popKey === `${r}-${c}` ? " pop" : ""}`;
        cell.textContent = val ? String(val) : "";
        gridEl.appendChild(cell);
      }
    }
    scoreEl.textContent = String(score);
    bestEl.textContent = String(best);
    undoBtn.disabled = !prevSnapshot || gameOver;
  }

  function initGame() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    score = 0;
    prevSnapshot = null;
    wonOnce = false;
    gameOver = false;
    overlay.classList.add("hidden");
    continueBtn.classList.add("hidden");
    addRandomTile();
    const key = addRandomTile();
    render(key);
  }

  function slideLine(line) {
    const filtered = line.filter((n) => n !== 0);
    const out = [];
    let gained = 0;
    let merged = false;

    for (let i = 0; i < filtered.length; i++) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        const combined = filtered[i] * 2;
        out.push(combined);
        gained += combined;
        merged = true;
        i++;
      } else {
        out.push(filtered[i]);
      }
    }
    while (out.length < SIZE) out.push(0);
    return { out, gained, merged };
  }

  function hasMovesLeft() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) return true;
        if (r + 1 < SIZE && board[r][c] === board[r + 1][c]) return true;
        if (c + 1 < SIZE && board[r][c] === board[r][c + 1]) return true;
      }
    }
    return false;
  }

  function move(dir) {
    if (gameOver || !overlay.classList.contains("hidden")) return;

    const snapshot = { board: cloneBoard(board), score };
    let moved = false;
    let totalGained = 0;
    let anyMerge = false;

    for (let i = 0; i < SIZE; i++) {
      let line = [];
      for (let j = 0; j < SIZE; j++) {
        if (dir === "LEFT") line.push(board[i][j]);
        if (dir === "RIGHT") line.push(board[i][SIZE - 1 - j]);
        if (dir === "UP") line.push(board[j][i]);
        if (dir === "DOWN") line.push(board[SIZE - 1 - j][i]);
      }

      const { out, gained, merged } = slideLine(line);
      totalGained += gained;
      if (merged) anyMerge = true;

      for (let j = 0; j < SIZE; j++) {
        const targetVal = out[j];
        if (dir === "LEFT") {
          if (board[i][j] !== targetVal) moved = true;
          board[i][j] = targetVal;
        } else if (dir === "RIGHT") {
          if (board[i][SIZE - 1 - j] !== targetVal) moved = true;
          board[i][SIZE - 1 - j] = targetVal;
        } else if (dir === "UP") {
          if (board[j][i] !== targetVal) moved = true;
          board[j][i] = targetVal;
        } else if (dir === "DOWN") {
          if (board[SIZE - 1 - j][i] !== targetVal) moved = true;
          board[SIZE - 1 - j][i] = targetVal;
        }
      }
    }

    if (!moved) return;

    prevSnapshot = snapshot;
    score += totalGained;
    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE_KEY, String(best));
    }

    playTone(anyMerge ? 540 : 320, 0.06);
    const popKey = addRandomTile();
    render(popKey);

    if (!wonOnce && board.some((row) => row.includes(2048))) {
      wonOnce = true;
      overlayTitle.textContent = "You Reached 2048!";
      overlayDesc.textContent = `Score: ${score}. Keep merging tiles or start a fresh board.`;
      continueBtn.classList.remove("hidden");
      overlay.classList.remove("hidden");
      playTone(760, 0.2);
      return;
    }

    if (!hasMovesLeft()) {
      gameOver = true;
      overlayTitle.textContent = "No Moves Left";
      overlayDesc.textContent = `Final score: ${score}`;
      continueBtn.classList.add("hidden");
      overlay.classList.remove("hidden");
      playTone(190, 0.2);
    }
  }

  undoBtn.addEventListener("click", () => {
    if (!prevSnapshot || gameOver) return;
    board = prevSnapshot.board;
    score = prevSnapshot.score;
    prevSnapshot = null;
    render();
  });

  newBtn.addEventListener("click", initGame);
  restartBtn.addEventListener("click", initGame);
  continueBtn.addEventListener("click", () => overlay.classList.add("hidden"));
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "Sound: On" : "Sound: Off";
  });

  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
    }
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") move("LEFT");
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") move("RIGHT");
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") move("UP");
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") move("DOWN");
  });

  gridEl.addEventListener("touchstart", (e) => {
    if (e.touches[0]) {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  });

  gridEl.addEventListener("touchend", (e) => {
    if (!touchStart || !e.changedTouches[0]) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "RIGHT" : "LEFT");
    else move(dy > 0 ? "DOWN" : "UP");
  });

  initGame();
})();
