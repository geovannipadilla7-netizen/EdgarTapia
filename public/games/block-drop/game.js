(() => {
  const COLS = 10;
  const ROWS = 20;
  const CELL = 26;
  const STORAGE_KEY = "arcade_shelf_blockdrop_best";

  const SHAPES = {
    I: { matrix: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: "#38bdf8" },
    O: { matrix: [[1, 1], [1, 1]], color: "#fbbf24" },
    T: { matrix: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: "#a855f7" },
    S: { matrix: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: "#10b981" },
    Z: { matrix: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: "#f43f5e" },
    J: { matrix: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: "#3b82f6" },
    L: { matrix: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: "#f97316" },
  };

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const nextCtx = document.getElementById("nextCanvas").getContext("2d");
  const holdCtx = document.getElementById("holdCanvas").getContext("2d");

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const linesLevelEl = document.getElementById("linesLevel");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayDesc = document.getElementById("overlayDesc");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const soundBtn = document.getElementById("soundBtn");

  let audioCtx = null;
  let soundOn = true;
  let state = "TITLE_MENU";
  let grid = [];
  let bag = [];
  let active = null;
  let nextType = null;
  let holdType = null;
  let canHold = true;
  let score = 0;
  let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
  let lines = 0;
  let level = 1;
  let dropCounter = 0;
  let lastTime = 0;

  bestEl.textContent = String(best);

  function playTone(freq, dur = 0.06, vol = 0.05) {
    if (!soundOn) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
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

  function refillBag() {
    const keys = Object.keys(SHAPES);
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    bag.push(...keys);
  }

  function pullPieceType() {
    if (bag.length < 2) refillBag();
    return bag.shift();
  }

  function createPiece(type) {
    const shape = SHAPES[type];
    const matrix = shape.matrix.map((row) => [...row]);
    return {
      type,
      matrix,
      color: shape.color,
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: 0,
    };
  }

  function collides(piece, dx = 0, dy = 0, mat = piece.matrix) {
    for (let r = 0; r < mat.length; r++) {
      for (let c = 0; c < mat[r].length; c++) {
        if (!mat[r][c]) continue;
        const nx = piece.x + c + dx;
        const ny = piece.y + r + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateMatrix(mat) {
    const N = mat.length;
    return mat.map((row, r) => row.map((_, c) => mat[N - 1 - c][r]));
  }

  function spawnNext() {
    const type = nextType || pullPieceType();
    nextType = pullPieceType();
    active = createPiece(type);
    canHold = true;
    drawPreview(nextCtx, nextType);
    if (collides(active)) {
      endGame();
    }
  }

  function lockPiece() {
    for (let r = 0; r < active.matrix.length; r++) {
      for (let c = 0; c < active.matrix[r].length; c++) {
        if (!active.matrix[r][c]) continue;
        const gy = active.y + r;
        const gx = active.x + c;
        if (gy >= 0 && gy < ROWS) grid[gy][gx] = active.color;
      }
    }

    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every((cell) => cell !== null)) {
        grid.splice(r, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }

    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800][cleared] || 800;
      score += points * level;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      playTone(640 + cleared * 60, 0.12);
    } else {
      playTone(240, 0.04);
    }

    updateStats();
    spawnNext();
  }

  function updateStats() {
    scoreEl.textContent = String(score);
    linesLevelEl.textContent = `${lines} · ${level}`;
    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE_KEY, String(best));
      bestEl.textContent = String(best);
    }
  }

  function holdPiece() {
    if (!canHold || state !== "PLAYING") return;
    canHold = false;
    const currentType = active.type;
    if (holdType) {
      active = createPiece(holdType);
      holdType = currentType;
    } else {
      holdType = currentType;
      spawnNext();
    }
    drawPreview(holdCtx, holdType);
    playTone(400, 0.05);
  }

  function hardDrop() {
    if (state !== "PLAYING") return;
    let dropped = 0;
    while (!collides(active, 0, 1)) {
      active.y++;
      dropped++;
    }
    score += dropped * 2;
    lockPiece();
  }

  function endGame() {
    state = "GAME_OVER";
    playTone(170, 0.25);
    overlayTitle.textContent = "Stack Topped Out";
    overlayDesc.textContent = `Score: ${score} · Lines cleared: ${lines}`;
    startBtn.textContent = "Play Again";
    overlay.classList.remove("hidden");
  }

  function startGame() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    bag = [];
    holdType = null;
    nextType = null;
    score = 0;
    lines = 0;
    level = 1;
    dropCounter = 0;
    drawPreview(holdCtx, null);
    updateStats();
    spawnNext();
    state = "PLAYING";
    pauseBtn.textContent = "Pause";
    overlay.classList.add("hidden");
    lastTime = performance.now();
  }

  function drawPreview(pCtx, type) {
    pCtx.clearRect(0, 0, 96, 72);
    if (!type) return;
    const shape = SHAPES[type];
    const mat = shape.matrix;
    const size = 16;
    const offsetX = (96 - mat[0].length * size) / 2;
    const offsetY = (72 - mat.length * size) / 2;
    pCtx.fillStyle = shape.color;
    for (let r = 0; r < mat.length; r++) {
      for (let c = 0; c < mat[r].length; c++) {
        if (mat[r][c]) {
          pCtx.beginPath();
          pCtx.roundRect(offsetX + c * size + 1, offsetY + r * size + 1, size - 2, size - 2, 3);
          pCtx.fill();
        }
      }
    }
  }

  function draw() {
    ctx.fillStyle = "#131b2b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#1b263b";
    ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, canvas.height);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(canvas.width, r * CELL);
      ctx.stroke();
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c]) {
          ctx.fillStyle = grid[r][c];
          ctx.beginPath();
          ctx.roundRect(c * CELL + 1.5, r * CELL + 1.5, CELL - 3, CELL - 3, 4);
          ctx.fill();
        }
      }
    }

    if (active) {
      // Ghost piece
      let ghostY = active.y;
      while (!collides(active, 0, ghostY - active.y + 1)) ghostY++;
      ctx.strokeStyle = "rgba(248, 250, 252, 0.25)";
      ctx.lineWidth = 1.5;
      for (let r = 0; r < active.matrix.length; r++) {
        for (let c = 0; c < active.matrix[r].length; c++) {
          if (active.matrix[r][c]) {
            ctx.strokeRect((active.x + c) * CELL + 2.5, (ghostY + r) * CELL + 2.5, CELL - 5, CELL - 5);
          }
        }
      }

      // Active piece
      ctx.fillStyle = active.color;
      for (let r = 0; r < active.matrix.length; r++) {
        for (let c = 0; c < active.matrix[r].length; c++) {
          if (active.matrix[r][c]) {
            ctx.beginPath();
            ctx.roundRect((active.x + c) * CELL + 1.5, (active.y + r) * CELL + 1.5, CELL - 3, CELL - 3, 4);
            ctx.fill();
          }
        }
      }
    }
  }

  function loop(now) {
    const dt = now - lastTime;
    lastTime = now;
    if (state === "PLAYING") {
      const interval = Math.max(110, 720 - (level - 1) * 58);
      dropCounter += dt;
      if (dropCounter >= interval) {
        dropCounter = 0;
        if (!collides(active, 0, 1)) active.y++;
        else lockPiece();
      }
    }
    draw();
    requestAnimationFrame(loop);
  }

  function togglePause() {
    if (state === "PLAYING") {
      state = "PAUSED";
      pauseBtn.textContent = "Resume";
      overlayTitle.textContent = "Paused";
      overlayDesc.textContent = "Press Resume to continue stacking.";
      startBtn.textContent = "Resume";
      overlay.classList.remove("hidden");
    } else if (state === "PAUSED") {
      state = "PLAYING";
      pauseBtn.textContent = "Pause";
      overlay.classList.add("hidden");
      lastTime = performance.now();
    }
  }

  startBtn.addEventListener("click", () => {
    if (state === "PAUSED") togglePause();
    else startGame();
  });

  pauseBtn.addEventListener("click", togglePause);
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "Sound: On" : "Sound: Off";
  });

  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      e.preventDefault();
    }
    if (state !== "PLAYING") {
      if (e.key === " " && (state === "TITLE_MENU" || state === "GAME_OVER")) startGame();
      else if (e.key === "p" || e.key === "P") togglePause();
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      if (!collides(active, -1, 0)) active.x--;
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      if (!collides(active, 1, 0)) active.x++;
    } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      if (!collides(active, 0, 1)) {
        active.y++;
        score += 1;
        updateStats();
      } else {
        lockPiece();
      }
      dropCounter = 0;
    } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      const rotated = rotateMatrix(active.matrix);
      const kicks = [0, -1, 1, -2, 2];
      for (const kx of kicks) {
        if (!collides(active, kx, 0, rotated)) {
          active.matrix = rotated;
          active.x += kx;
          playTone(360, 0.04);
          break;
        }
      }
    } else if (e.key === " ") {
      hardDrop();
    } else if (e.key === "c" || e.key === "C" || e.key === "Shift") {
      holdPiece();
    } else if (e.key === "p" || e.key === "P") {
      togglePause();
    }
  });

  grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  requestAnimationFrame(loop);
})();
