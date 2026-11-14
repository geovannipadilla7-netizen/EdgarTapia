(() => {
  const SYMBOLS = [
    { id: "diamond", color: "#f59e0b", svg: '<polygon points="24,6 42,24 24,42 6,24"/>' },
    { id: "circle", color: "#10b981", svg: '<circle cx="24" cy="24" r="14"/>' },
    { id: "triangle", color: "#ef4444", svg: '<polygon points="24,7 41,38 7,38"/>' },
    { id: "square", color: "#3b82f6", svg: '<rect x="10" y="10" width="28" height="28" rx="4"/>' },
    { id: "cross", color: "#a855f7", svg: '<path d="M19 8h10v11h11v10H29v11H19V29H8V19h11z"/>' },
    { id: "ring", color: "#0ea5e9", svg: '<circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" stroke-width="6"/>' },
    { id: "star", color: "#ea580c", svg: '<polygon points="24,5 29,18 43,18 32,26 36,40 24,32 12,40 16,26 5,18 19,18"/>' },
    { id: "hex", color: "#0d9488", svg: '<polygon points="24,6 39,15 39,33 24,42 9,33 9,15"/>' },
    { id: "bolt", color: "#eab308", svg: '<polygon points="26,5 11,26 23,26 20,43 37,21 25,21"/>' },
    { id: "crescent", color: "#6366f1", svg: '<path d="M31 9a15 15 0 1 0 9 27A13 13 0 0 1 31 9z"/>' },
    { id: "bars", color: "#ec4899", svg: '<rect x="9" y="11" width="30" height="6" rx="2"/><rect x="9" y="21" width="30" height="6" rx="2"/><rect x="9" y="31" width="30" height="6" rx="2"/>' },
    { id: "arch", color: "#14b8a6", svg: '<path d="M10 38V22a14 14 0 0 1 28 0v16h-8V22a6 6 0 0 0-12 0v16z"/>' },
  ];

  const gridEl = document.getElementById("grid");
  const movesEl = document.getElementById("moves");
  const pairsEl = document.getElementById("pairs");
  const scoreEl = document.getElementById("score");
  const sizeSelect = document.getElementById("sizeSelect");
  const restartBtn = document.getElementById("restartBtn");
  const soundBtn = document.getElementById("soundBtn");
  const overlay = document.getElementById("overlay");
  const overlayDesc = document.getElementById("overlayDesc");
  const playAgainBtn = document.getElementById("playAgainBtn");

  let audioCtx = null;
  let soundOn = true;
  let totalPairs = 8;
  let cards = [];
  let flipped = [];
  let locked = false;
  let moves = 0;
  let matchedPairs = 0;
  let score = 0;
  let streak = 0;

  function playTone(freq, dur = 0.08, vol = 0.05) {
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

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function updateHud() {
    movesEl.textContent = String(moves);
    pairsEl.textContent = `${matchedPairs}/${totalPairs}`;
    scoreEl.textContent = String(score);
  }

  function initGame() {
    const isLarge = sizeSelect.value === "6x4";
    totalPairs = isLarge ? 12 : 8;
    const cols = isLarge ? 6 : 4;
    const rows = 4;

    gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gridEl.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    const picked = SYMBOLS.slice(0, totalPairs);
    const deck = shuffle([...picked, ...picked]);

    flipped = [];
    locked = false;
    moves = 0;
    matchedPairs = 0;
    score = 0;
    streak = 0;
    overlay.classList.add("hidden");
    updateHud();

    gridEl.innerHTML = "";
    cards = deck.map((sym, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card";
      btn.setAttribute("aria-label", "Face-down card");
      btn.innerHTML = `
        <div class="card-inner">
          <div class="card-face card-back"></div>
          <div class="card-face card-front" style="color:${sym.color}">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="currentColor">${sym.svg}</svg>
          </div>
        </div>
      `;
      const item = { idx, sym, btn, matched: false };
      btn.addEventListener("click", () => handleFlip(item));
      gridEl.appendChild(btn);
      return item;
    });
  }

  function handleFlip(item) {
    if (locked || item.matched || flipped.includes(item)) return;
    item.btn.classList.add("flipped");
    flipped.push(item);
    playTone(380, 0.05);

    if (flipped.length < 2) return;

    moves++;
    const [a, b] = flipped;
    if (a.sym.id === b.sym.id) {
      a.matched = true;
      b.matched = true;
      a.btn.classList.add("matched");
      b.btn.classList.add("matched");
      matchedPairs++;
      streak++;
      score += 100 + (streak - 1) * 40;
      flipped = [];
      playTone(620 + streak * 40, 0.12);
      updateHud();

      if (matchedPairs === totalPairs) {
        overlayDesc.textContent = `Cleared ${totalPairs} pairs in ${moves} moves · Final score: ${score}`;
        overlay.classList.remove("hidden");
      }
    } else {
      streak = 0;
      locked = true;
      updateHud();
      setTimeout(() => {
        a.btn.classList.remove("flipped");
        b.btn.classList.remove("flipped");
        flipped = [];
        locked = false;
      }, 650);
    }
  }

  sizeSelect.addEventListener("change", initGame);
  restartBtn.addEventListener("click", initGame);
  playAgainBtn.addEventListener("click", initGame);
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "Sound: On" : "Sound: Off";
  });

  initGame();
})();
