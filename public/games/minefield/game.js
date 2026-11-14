(() => {
  const PRESETS = {
    9: { size: 9, mines: 10 },
    12: { size: 12, mines: 20 },
    16: { size: 16, mines: 40 },
  };

  const boardEl = document.getElementById("board");
  const minesLeftEl = document.getElementById("minesLeft");
  const timerEl = document.getElementById("timer");
  const sizeSelect = document.getElementById("sizeSelect");
  const flagModeBtn = document.getElementById("flagModeBtn");
  const resetBtn = document.getElementById("resetBtn");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayDesc = document.getElementById("overlayDesc");
  const playAgainBtn = document.getElementById("playAgainBtn");

  let size = 9;
  let totalMines = 10;
  let grid = [];
  let firstClick = true;
  let gameOver = false;
  let flagMode = false;
  let flagsUsed = 0;
  let revealedCount = 0;
  let seconds = 0;
  let timerId = null;

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer() {
    if (timerId) return;
    timerId = setInterval(() => {
      seconds += 1;
      timerEl.textContent = `${seconds}s`;
    }, 1000);
  }

  function initBoard() {
    stopTimer();
    const preset = PRESETS[Number(sizeSelect.value)] || PRESETS[9];
    size = preset.size;
    totalMines = preset.mines;
    firstClick = true;
    gameOver = false;
    flagsUsed = 0;
    revealedCount = 0;
    seconds = 0;
    timerEl.textContent = "0s";
    minesLeftEl.textContent = String(totalMines);
    overlay.classList.add("hidden");

    grid = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => ({
        r,
        c,
        mine: false,
        revealed: false,
        flagged: false,
        adj: 0,
      }))
    );

    boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    boardEl.style.gridTemplateRows = `repeat(${size}, 1fr)`;
    renderBoard();
  }

  function neighbors(r, c) {
    const res = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) res.push(grid[nr][nc]);
      }
    }
    return res;
  }

  function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < totalMines) {
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      const isNearSafe = Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1;
      if (!grid[r][c].mine && !isNearSafe) {
        grid[r][c].mine = true;
        placed++;
      }
    }
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!grid[r][c].mine) {
          grid[r][c].adj = neighbors(r, c).filter((n) => n.mine).length;
        }
      }
    }
  }

  function revealCell(cell) {
    if (gameOver || cell.revealed || cell.flagged) return;
    if (firstClick) {
      firstClick = false;
      placeMines(cell.r, cell.c);
      startTimer();
    }

    if (cell.mine) {
      cell.revealed = true;
      endGame(false);
      return;
    }

    const queue = [cell];
    while (queue.length) {
      const curr = queue.shift();
      if (curr.revealed || curr.flagged) continue;
      curr.revealed = true;
      revealedCount++;
      if (curr.adj === 0) {
        for (const n of neighbors(curr.r, curr.c)) {
          if (!n.revealed && !n.mine) queue.push(n);
        }
      }
    }

    renderBoard();
    if (revealedCount === size * size - totalMines) {
      endGame(true);
    }
  }

  function toggleFlag(cell) {
    if (gameOver || cell.revealed) return;
    cell.flagged = !cell.flagged;
    flagsUsed += cell.flagged ? 1 : -1;
    minesLeftEl.textContent = String(totalMines - flagsUsed);
    renderBoard();
  }

  function endGame(won) {
    gameOver = true;
    stopTimer();
    if (!won) {
      for (const row of grid) {
        for (const cell of row) {
          if (cell.mine) cell.revealed = true;
        }
      }
    }
    renderBoard();
    overlayTitle.textContent = won ? "Board Cleared!" : "Mine Triggered";
    overlayDesc.textContent = won
      ? `Cleared ${size}×${size} in ${seconds} seconds.`
      : `Completed ${revealedCount} of ${size * size - totalMines} safe cells.`;
    overlay.classList.remove("hidden");
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    const fontSize = size === 16 ? "11px" : size === 12 ? "13px" : "15px";

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = grid[r][c];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tile";
        btn.style.fontSize = fontSize;

        if (cell.revealed) {
          btn.classList.add("revealed");
          if (cell.mine) {
            btn.classList.add("mine");
            btn.textContent = "●";
          } else if (cell.adj > 0) {
            btn.classList.add(`n-${cell.adj}`);
            btn.textContent = String(cell.adj);
          }
        } else if (cell.flagged) {
          btn.classList.add("flagged");
          btn.textContent = "⚑";
        }

        btn.addEventListener("click", () => {
          if (flagMode) toggleFlag(cell);
          else revealCell(cell);
        });

        btn.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          toggleFlag(cell);
        });

        boardEl.appendChild(btn);
      }
    }
  }

  flagModeBtn.addEventListener("click", () => {
    flagMode = !flagMode;
    flagModeBtn.textContent = flagMode ? "Mode: Flag" : "Mode: Reveal";
    flagModeBtn.classList.toggle("active", flagMode);
  });

  sizeSelect.addEventListener("change", initBoard);
  resetBtn.addEventListener("click", initBoard);
  playAgainBtn.addEventListener("click", initBoard);

  initBoard();
})();
