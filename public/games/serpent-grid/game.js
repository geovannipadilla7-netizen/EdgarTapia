(() => {
  const GRID = 20;
  const CELL = 24;
  const STORAGE_KEY = "arcade_shelf_serpent_best";

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const speedEl = document.getElementById("speed");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayDesc = document.getElementById("overlayDesc");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const soundBtn = document.getElementById("soundBtn");

  let audioCtx = null;
  let soundOn = true;
  let gameState = "TITLE_MENU"; // TITLE_MENU | PLAYING | PAUSED | GAME_OVER
  let snake = [];
  let dir = { x: 1, y: 0 };
  let dirQueue = [];
  let food = { x: 14, y: 10 };
  let bonus = null;
  let bonusTimer = 0;
  let score = 0;
  let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
  let lastTick = 0;
  let stepMs = 135;
  let rafId = null;

  bestEl.textContent = String(best);

  function playTone(freq, duration, type = "sine", vol = 0.06) {
    if (!soundOn) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {
      // Audio unavailable
    }
  }

  function randomFreeCell() {
    const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
    if (food) occupied.add(`${food.x},${food.y}`);
    if (bonus) occupied.add(`${bonus.x},${bonus.y}`);
    const free = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    return free.length ? free[Math.floor(Math.random() * free.length)] : { x: 0, y: 0 };
  }

  function resetGame() {
    snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    dir = { x: 1, y: 0 };
    dirQueue = [];
    score = 0;
    stepMs = 135;
    bonus = null;
    bonusTimer = 0;
    food = randomFreeCell();
    scoreEl.textContent = "0";
    speedEl.textContent = "1.0x";
    gameState = "PLAYING";
    pauseBtn.textContent = "Pause";
    overlay.classList.add("hidden");
    lastTick = performance.now();
    draw();
  }

  function queueDirection(next) {
    if (gameState !== "PLAYING") return;
    const prev = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
    if (prev.x + next.x === 0 && prev.y + next.y === 0) return;
    if (prev.x === next.x && prev.y === next.y) return;
    if (dirQueue.length < 3) dirQueue.push(next);
  }

  function endGame() {
    gameState = "GAME_OVER";
    playTone(170, 0.28, "sawtooth", 0.07);
    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE_KEY, String(best));
      bestEl.textContent = String(best);
    }
    overlayTitle.textContent = "Game Over";
    overlayDesc.textContent = `Final score: ${score} · Serpent length: ${snake.length}`;
    startBtn.textContent = "Play Again";
    overlay.classList.remove("hidden");
  }

  function step() {
    if (dirQueue.length) {
      dir = dirQueue.shift();
    }
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
      endGame();
      return;
    }

    const willEatFood = head.x === food.x && head.y === food.y;
    const bodyToCheck = willEatFood ? snake : snake.slice(0, -1);
    if (bodyToCheck.some((seg) => seg.x === head.x && seg.y === head.y)) {
      endGame();
      return;
    }

    snake.unshift(head);

    if (willEatFood) {
      score += 10;
      playTone(540, 0.08, "triangle", 0.07);
      food = randomFreeCell();
      if (!bonus && Math.random() < 0.25) {
        bonus = randomFreeCell();
        bonusTimer = 45;
      }
      stepMs = Math.max(72, 135 - Math.floor(score / 40) * 6);
    } else {
      snake.pop();
    }

    if (bonus) {
      if (head.x === bonus.x && head.y === bonus.y) {
        score += 30;
        playTone(760, 0.14, "sine", 0.08);
        bonus = null;
        bonusTimer = 0;
      } else {
        bonusTimer -= 1;
        if (bonusTimer <= 0) bonus = null;
      }
    }

    scoreEl.textContent = String(score);
    const mult = (135 / stepMs).toFixed(1);
    speedEl.textContent = `${mult}x`;
    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE_KEY, String(best));
      bestEl.textContent = String(best);
    }
  }

  function draw() {
    ctx.fillStyle = "#131b2b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid lines
    ctx.strokeStyle = "#1b263b";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      const p = i * CELL;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(canvas.width, p);
      ctx.stroke();
    }

    // Food
    if (food) {
      const fx = food.x * CELL + CELL / 2;
      const fy = food.y * CELL + CELL / 2;
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(fx, fy, CELL * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bonus orb
    if (bonus) {
      const bx = bonus.x * CELL + CELL / 2;
      const by = bonus.y * CELL + CELL / 2;
      ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, CELL * 0.42, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(bx, by, CELL * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }

    // Snake segments
    for (let i = snake.length - 1; i >= 0; i--) {
      const seg = snake[i];
      const pad = 2;
      const x = seg.x * CELL + pad;
      const y = seg.y * CELL + pad;
      const size = CELL - pad * 2;
      ctx.fillStyle = i === 0 ? "#34d399" : i % 2 === 0 ? "#10b981" : "#059669";
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, 5);
      ctx.fill();

      if (i === 0) {
        ctx.fillStyle = "#0e131f";
        const ex1 = dir.x === 0 ? x + 5 : dir.x > 0 ? x + size - 6 : x + 4;
        const ey1 = dir.y === 0 ? y + 5 : dir.y > 0 ? y + size - 6 : y + 4;
        const ex2 = dir.x === 0 ? x + size - 5 : ex1;
        const ey2 = dir.y === 0 ? ey1 : y + size - 5;
        ctx.beginPath();
        ctx.arc(ex1, ey1, 2, 0, Math.PI * 2);
        ctx.arc(ex2, ey2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function loop(now) {
    if (gameState === "PLAYING" && now - lastTick >= stepMs) {
      lastTick = now;
      step();
      draw();
    }
    rafId = requestAnimationFrame(loop);
  }

  function togglePause() {
    if (gameState === "PLAYING") {
      gameState = "PAUSED";
      pauseBtn.textContent = "Resume";
      overlayTitle.textContent = "Paused";
      overlayDesc.textContent = "Press Resume or Space to continue.";
      startBtn.textContent = "Resume Game";
      overlay.classList.remove("hidden");
    } else if (gameState === "PAUSED") {
      gameState = "PLAYING";
      pauseBtn.textContent = "Pause";
      overlay.classList.add("hidden");
      lastTick = performance.now();
    }
  }

  startBtn.addEventListener("click", () => {
    if (gameState === "PAUSED") {
      togglePause();
    } else {
      resetGame();
    }
  });

  pauseBtn.addEventListener("click", togglePause);

  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "Sound: On" : "Sound: Off";
  });

  document.querySelectorAll(".dpad-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = btn.dataset.dir;
      if (d === "UP") queueDirection({ x: 0, y: -1 });
      if (d === "DOWN") queueDirection({ x: 0, y: 1 });
      if (d === "LEFT") queueDirection({ x: -1, y: 0 });
      if (d === "RIGHT") queueDirection({ x: 1, y: 0 });
    });
  });

  window.addEventListener("keydown", (e) => {
    const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "];
    if (keys.includes(e.key)) e.preventDefault();

    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") queueDirection({ x: 0, y: -1 });
    else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") queueDirection({ x: 0, y: 1 });
    else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") queueDirection({ x: -1, y: 0 });
    else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") queueDirection({ x: 1, y: 0 });
    else if (e.key === " " || e.key === "p" || e.key === "P") {
      if (gameState === "TITLE_MENU" || gameState === "GAME_OVER") resetGame();
      else togglePause();
    }
  });

  draw();
  rafId = requestAnimationFrame(loop);
  window.addEventListener("beforeunload", () => cancelAnimationFrame(rafId));
})();
