(() => {
  const STORAGE_KEY = "arcade_shelf_breakout_best";
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const stageEl = document.getElementById("stageNum");
  const livesEl = document.getElementById("lives");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayDesc = document.getElementById("overlayDesc");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const soundBtn = document.getElementById("soundBtn");

  let audioCtx = null;
  let soundOn = true;
  let gameState = "TITLE_MENU"; // TITLE_MENU | PLAYING | PAUSED | GAME_OVER
  let score = 0;
  let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
  let lives = 3;
  let level = 1;

  const paddle = { w: 104, h: 13, x: 248, y: 406, speed: 460, wideTimer: 0 };
  const ball = { x: 300, y: 392, r: 7, vx: 210, vy: -310, stuck: true };
  let bricks = [];
  let powerups = [];
  const keys = { left: false, right: false };
  let lastTime = performance.now();

  bestEl.textContent = String(best);

  function playTone(freq, dur = 0.08, type = "triangle", vol = 0.06) {
    if (!soundOn) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch (_) {
      // ignore audio error
    }
  }

  function buildStage(lvl) {
    bricks = [];
    powerups = [];
    const cols = 8;
    const rows = 4 + lvl;
    const padX = 24;
    const gap = 8;
    const brickW = (canvas.width - padX * 2 - gap * (cols - 1)) / cols;
    const brickH = 22;
    const colors = ["#f59e0b", "#ea580c", "#10b981", "#38bdf8", "#a855f7", "#eab308"];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (lvl === 2 && (r + c) % 7 === 0) continue;
        if (lvl === 3 && r === 2 && c > 1 && c < 6) continue;
        const armor = lvl >= 2 && r === 0 ? 2 : lvl === 3 && r === 2 ? 2 : 1;
        bricks.push({
          x: padX + c * (brickW + gap),
          y: 44 + r * (brickH + gap),
          w: brickW,
          h: brickH,
          hp: armor,
          maxHp: armor,
          color: armor === 2 ? "#cbd5e1" : colors[r % colors.length],
        });
      }
    }
    resetBallOnPaddle();
    stageEl.textContent = `${lvl}/3`;
  }

  function resetBallOnPaddle() {
    paddle.w = 104;
    paddle.wideTimer = 0;
    paddle.x = Math.max(12, Math.min(canvas.width - paddle.w - 12, paddle.x));
    ball.stuck = true;
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r - 2;
    const speedScale = 1 + (level - 1) * 0.1;
    ball.vx = (Math.random() > 0.5 ? 1 : -1) * 215 * speedScale;
    ball.vy = -315 * speedScale;
  }

  function startNewGame() {
    score = 0;
    lives = 3;
    level = 1;
    paddle.x = (canvas.width - 104) / 2;
    scoreEl.textContent = "0";
    livesEl.textContent = "3";
    buildStage(level);
    gameState = "PLAYING";
    pauseBtn.textContent = "Pause";
    overlay.classList.add("hidden");
  }

  function updateHudScore(pts) {
    score += pts;
    scoreEl.textContent = String(score);
    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE_KEY, String(best));
      bestEl.textContent = String(best);
    }
  }

  function showEndModal(won) {
    gameState = "GAME_OVER";
    overlayTitle.textContent = won ? "All Stages Cleared!" : "Game Over";
    overlayDesc.textContent = `Final score: ${score} · Reached stage ${level}/3`;
    startBtn.textContent = "Play Again";
    overlay.classList.remove("hidden");
  }

  function update(dt) {
    if (gameState !== "PLAYING") return;

    if (keys.left) paddle.x -= paddle.speed * dt;
    if (keys.right) paddle.x += paddle.speed * dt;
    paddle.x = Math.max(8, Math.min(canvas.width - paddle.w - 8, paddle.x));

    if (paddle.wideTimer > 0) {
      paddle.wideTimer -= dt;
      if (paddle.wideTimer <= 0) {
        paddle.w = 104;
        paddle.x = Math.min(paddle.x, canvas.width - paddle.w - 8);
      }
    }

    if (ball.stuck) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 2;
      return;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r <= 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
      playTone(320, 0.05);
    } else if (ball.x + ball.r >= canvas.width) {
      ball.x = canvas.width - ball.r;
      ball.vx = -Math.abs(ball.vx);
      playTone(320, 0.05);
    }

    if (ball.y - ball.r <= 0) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
      playTone(350, 0.05);
    }

    // Paddle bounce
    if (
      ball.vy > 0 &&
      ball.y + ball.r >= paddle.y &&
      ball.y - ball.r <= paddle.y + paddle.h &&
      ball.x >= paddle.x - 4 &&
      ball.x <= paddle.x + paddle.w + 4
    ) {
      const hitPos = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const speed = Math.hypot(ball.vx, ball.vy);
      const angle = hitPos * (Math.PI / 3);
      ball.vx = speed * Math.sin(angle);
      ball.vy = -Math.abs(speed * Math.cos(angle));
      ball.y = paddle.y - ball.r - 1;
      playTone(440, 0.06);
    }

    // Brick collision
    for (let i = bricks.length - 1; i >= 0; i--) {
      const b = bricks[i];
      const closestX = Math.max(b.x, Math.min(ball.x, b.x + b.w));
      const closestY = Math.max(b.y, Math.min(ball.y, b.y + b.h));
      const dx = ball.x - closestX;
      const dy = ball.y - closestY;
      if (dx * dx + dy * dy <= ball.r * ball.r) {
        if (Math.abs(dx) > Math.abs(dy)) ball.vx *= -1;
        else ball.vy *= -1;
        b.hp -= 1;
        if (b.hp <= 0) {
          updateHudScore(b.maxHp === 2 ? 25 : 15);
          playTone(620, 0.08);
          if (Math.random() < 0.16) {
            powerups.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vy: 130 });
          }
          bricks.splice(i, 1);
        } else {
          b.color = "#64748b";
          playTone(490, 0.06);
        }
        break;
      }
    }

    // Powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.vy * dt;
      if (
        p.y + 8 >= paddle.y &&
        p.y - 8 <= paddle.y + paddle.h &&
        p.x >= paddle.x &&
        p.x <= paddle.x + paddle.w
      ) {
        paddle.w = 148;
        paddle.wideTimer = 9;
        paddle.x = Math.min(paddle.x, canvas.width - paddle.w - 8);
        updateHudScore(20);
        playTone(740, 0.12);
        powerups.splice(i, 1);
      } else if (p.y > canvas.height + 20) {
        powerups.splice(i, 1);
      }
    }

    if (bricks.length === 0) {
      if (level < 3) {
        level += 1;
        playTone(820, 0.18);
        buildStage(level);
      } else {
        playTone(880, 0.25);
        showEndModal(true);
      }
      return;
    }

    if (ball.y - ball.r > canvas.height) {
      lives -= 1;
      livesEl.textContent = String(lives);
      playTone(180, 0.22, "sawtooth");
      if (lives <= 0) {
        showEndModal(false);
      } else {
        resetBallOnPaddle();
      }
    }
  }

  function draw() {
    ctx.fillStyle = "#131b2b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Bricks
    for (const b of bricks) {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fill();
    }

    // Powerups
    for (const p of powerups) {
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.roundRect(p.x - 10, p.y - 6, 20, 12, 6);
      ctx.fill();
    }

    // Paddle
    ctx.fillStyle = paddle.wideTimer > 0 ? "#fbbf24" : "#38bdf8";
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
    ctx.fill();

    // Ball
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    if (ball.stuck && gameState === "PLAYING") {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Click or press Space to launch", canvas.width / 2, 340);
    }
  }

  function loop(now) {
    const dt = Math.min(0.032, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function togglePause() {
    if (gameState === "PLAYING") {
      gameState = "PAUSED";
      pauseBtn.textContent = "Resume";
      overlayTitle.textContent = "Paused";
      overlayDesc.textContent = "Press Resume or Space to keep playing.";
      startBtn.textContent = "Resume Game";
      overlay.classList.remove("hidden");
    } else if (gameState === "PAUSED") {
      gameState = "PLAYING";
      pauseBtn.textContent = "Pause";
      overlay.classList.add("hidden");
    }
  }

  function movePaddleToClientX(clientX) {
    if (gameState !== "PLAYING") return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (clientX - rect.left) * scaleX - paddle.w / 2;
    paddle.x = Math.max(8, Math.min(canvas.width - paddle.w - 8, x));
  }

  canvas.addEventListener("mousemove", (e) => movePaddleToClientX(e.clientX));
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches[0]) movePaddleToClientX(e.touches[0].clientX);
  });
  canvas.addEventListener("click", () => {
    if (gameState === "PLAYING" && ball.stuck) ball.stuck = false;
  });

  startBtn.addEventListener("click", () => {
    if (gameState === "PAUSED") togglePause();
    else startNewGame();
  });

  pauseBtn.addEventListener("click", togglePause);
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "Sound: On" : "Sound: Off";
  });

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
    if (e.key === " ") {
      if (gameState === "PLAYING" && ball.stuck) ball.stuck = false;
      else if (gameState === "PLAYING" || gameState === "PAUSED") togglePause();
      else startNewGame();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
  });

  buildStage(1);
  requestAnimationFrame(loop);
})();
