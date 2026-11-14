const CATEGORIES = ['All', 'Arcade', 'Puzzle', 'Classics'];

const ICONS = {
  shuffle:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/></svg>',
  play:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  playLg:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  code:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>',
  search:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  arrowLeft:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
  restart:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
  fullscreen:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></svg>',
  close:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  gamepad:
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="2"/></svg>',
};

function resolveAssetPath(assetPath, catalogBase) {
  if (!assetPath) return '';
  if (/^(https?:)?\/\//.test(assetPath) || assetPath.startsWith('/')) return assetPath;
  const clean = assetPath.replace(/^\.\//, '');
  return `${catalogBase}${clean}`;
}

function parseIframeMarkup(htmlString, fallbackTitle, catalogBase) {
  if (!htmlString) return null;
  const doc = new DOMParser().parseFromString(htmlString, 'text/html');
  const el = doc.querySelector('iframe');
  if (!el) return null;
  const rawSrc = el.getAttribute('src') || el.getAttribute('data-src');
  if (!rawSrc) return null;
  return {
    id: el.getAttribute('id') || '',
    src: resolveAssetPath(rawSrc, catalogBase),
    dataSrc: el.getAttribute('data-src') || '',
    title: el.getAttribute('title') || fallbackTitle,
    allow: el.getAttribute('allow') || '',
    sandbox: el.getAttribute('sandbox') || '',
    allowFullscreen: el.hasAttribute('allowfullscreen'),
    extraClass: el.getAttribute('class') || '',
  };
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function createFallbackThumb(title) {
  const fallback = createEl('div', 'thumb-fallback');
  fallback.innerHTML = ICONS.gamepad;
  fallback.appendChild(createEl('span', '', title));
  return fallback;
}

function createThumbImg(src, title) {
  if (!src) {
    return createFallbackThumb(title);
  }
  const img = document.createElement('img');
  img.src = src;
  img.alt = `${title} cover artwork`;
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', () => {
    const parent = img.parentElement;
    if (!parent) return;
    parent.replaceChild(createFallbackThumb(title), img);
  });
  return img;
}

export function initApp(rootEl) {
  const state = {
    catalog: null,
    catalogBase: './',
    loading: true,
    error: null,
    selectedCategory: 'All',
    searchQuery: '',
    activeGameId: null,
    showJsonModal: false,
  };

  let shellEl = null;
  let mainEl = null;
  let footerCountEl = null;
  let navButtons = [];
  let randomBtn = null;
  let modalBackdropEl = null;
  let modalCodeEl = null;
  let activeStageRef = null;

  function getGames() {
    return state.catalog?.games ?? [];
  }

  function getFilteredGames() {
    const q = state.searchQuery.trim().toLowerCase();
    return getGames().filter((game) => {
      const matchesCat = state.selectedCategory === 'All' || game.category === state.selectedCategory;
      const matchesQuery =
        !q ||
        game.title.toLowerCase().includes(q) ||
        game.description.toLowerCase().includes(q) ||
        game.category.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }

  function getActiveGame() {
    return getGames().find((g) => g.id === state.activeGameId) ?? null;
  }

  function updateHeaderState() {
    const active = getActiveGame();
    navButtons.forEach(({ category, btn }) => {
      const isCurrent = !active && state.selectedCategory === category;
      btn.classList.toggle('is-active', isCurrent);
    });
    if (randomBtn) {
      randomBtn.disabled = getGames().length === 0;
    }
    if (footerCountEl) {
      footerCountEl.textContent = `EdgarTapia Class · ${getGames().length} HTML/JS/CSS games`;
    }
  }

  function openJsonModal() {
    if (!state.catalog || !modalBackdropEl || !modalCodeEl) return;
    state.showJsonModal = true;
    modalCodeEl.textContent = JSON.stringify(state.catalog, null, 2);
    modalBackdropEl.classList.remove('hidden');
  }

  function closeJsonModal() {
    state.showJsonModal = false;
    modalBackdropEl?.classList.add('hidden');
  }

  function launchGame(gameId) {
    state.activeGameId = gameId;
    renderMain();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleRandomGame() {
    const games = getGames();
    if (!games.length) return;
    const pool =
      state.activeGameId && games.length > 1
        ? games.filter((g) => g.id !== state.activeGameId)
        : games;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    launchGame(choice.id);
  }

  function renderGameCards(gridEl, countEl) {
    const filtered = getFilteredGames();
    if (countEl) {
      countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'title' : 'titles'}`;
    }

    gridEl.innerHTML = '';

    if (filtered.length === 0) {
      gridEl.className = '';
      const empty = createEl('div', 'status-panel');
      if (getGames().length === 0) {
        empty.appendChild(createEl('h1', '', 'No games in catalog'));
        empty.appendChild(
          createEl(
            'p',
            '',
            'Add game objects with an iframe field to games.json to display them here.'
          )
        );
        const inspectBtn = createEl('button', 'btn-secondary');
        inspectBtn.type = 'button';
        inspectBtn.style.marginTop = '16px';
        inspectBtn.innerHTML = `${ICONS.code}<span>View games.json</span>`;
        inspectBtn.addEventListener('click', openJsonModal);
        empty.appendChild(inspectBtn);
      } else {
        empty.appendChild(createEl('p', '', 'No games match your current filter.'));
        const resetBtn = createEl('button', 'btn-secondary', 'Reset Filters');
        resetBtn.type = 'button';
        resetBtn.style.marginTop = '16px';
        resetBtn.addEventListener('click', () => {
          state.selectedCategory = 'All';
          state.searchQuery = '';
          renderMain();
        });
        empty.appendChild(resetBtn);
      }
      gridEl.appendChild(empty);
      return;
    }

    gridEl.className = 'games-grid';

    filtered.forEach((game) => {
      const card = createEl('article', 'game-card');

      const thumbBtn = createEl('button', 'card-thumb');
      thumbBtn.type = 'button';
      thumbBtn.setAttribute('aria-label', `Play ${game.title}`);
      thumbBtn.appendChild(
        createThumbImg(resolveAssetPath(game.thumbnail, state.catalogBase), game.title)
      );
      thumbBtn.addEventListener('click', () => launchGame(game.id));

      const body = createEl('div', 'card-body');
      const info = createEl('div');

      const meta = createEl('div', 'card-meta');
      meta.appendChild(createEl('span', '', `${game.category} · ${game.players}`));
      meta.appendChild(createEl('span', 'card-controls', game.controls));

      info.appendChild(meta);
      info.appendChild(createEl('h3', 'card-title', game.title));
      info.appendChild(createEl('p', 'card-desc', game.description));

      const playBtn = createEl('button', 'card-play-btn');
      playBtn.type = 'button';
      playBtn.innerHTML = `${ICONS.play}<span>Play Game</span>`;
      playBtn.addEventListener('click', () => launchGame(game.id));

      body.appendChild(info);
      body.appendChild(playBtn);

      card.appendChild(thumbBtn);
      card.appendChild(body);
      gridEl.appendChild(card);
    });
  }

  function renderLibraryView() {
    const games = getGames();
    const featured = games[0];
    const wrapper = createEl('div');

    if (featured) {
      const hero = createEl('section', 'hero-spotlight');
      const copy = createEl('div', 'hero-copy');
      const copyTop = createEl('div');

      const meta = createEl('p', 'hero-meta');
      meta.textContent = `Featured Game · ${featured.category} · ${featured.controls}`;

      const title = createEl('h1', 'hero-title', 'Classic browser games, ready to play');
      const desc = createEl('p', 'hero-desc');
      desc.innerHTML =
        'Curated browser games built with HTML, CSS, and JavaScript. Every title loads directly from its iframe entry in <code class="inline-code">games.json</code>.';

      copyTop.appendChild(meta);
      copyTop.appendChild(title);
      copyTop.appendChild(desc);

      const actions = createEl('div', 'hero-actions');
      const playFeaturedBtn = createEl('button', 'btn-primary');
      playFeaturedBtn.type = 'button';
      playFeaturedBtn.innerHTML = `${ICONS.play}<span>Play ${featured.title}</span>`;
      playFeaturedBtn.addEventListener('click', () => launchGame(featured.id));

      const jsonBtn = createEl('button', 'btn-secondary');
      jsonBtn.type = 'button';
      jsonBtn.innerHTML = `${ICONS.code}<span>View games.json</span>`;
      jsonBtn.addEventListener('click', openJsonModal);

      actions.appendChild(playFeaturedBtn);
      actions.appendChild(jsonBtn);
      copy.appendChild(copyTop);
      copy.appendChild(actions);

      const previewCol = createEl('div');
      const previewBtn = createEl('button', 'hero-preview-btn');
      previewBtn.type = 'button';
      previewBtn.setAttribute('aria-label', `Launch ${featured.title}`);
      previewBtn.appendChild(
        createThumbImg(resolveAssetPath(featured.thumbnail, state.catalogBase), featured.title)
      );
      previewBtn.appendChild(createEl('div', 'hero-scrim'));

      const previewFooter = createEl('div', 'hero-preview-footer');
      const previewText = createEl('div');
      previewText.appendChild(createEl('p', 'hero-preview-title', featured.title));
      previewText.appendChild(createEl('p', 'hero-preview-sub', featured.description));

      const playSquare = createEl('span', 'play-square');
      playSquare.innerHTML = ICONS.playLg;

      previewFooter.appendChild(previewText);
      previewFooter.appendChild(playSquare);
      previewBtn.appendChild(previewFooter);
      previewBtn.addEventListener('click', () => launchGame(featured.id));
      previewCol.appendChild(previewBtn);

      hero.appendChild(copy);
      hero.appendChild(previewCol);
      wrapper.appendChild(hero);
    }

    const librarySection = createEl('section');
    librarySection.id = 'game-library';
    librarySection.setAttribute('aria-label', 'Game Library');

    const libHeader = createEl('div', 'library-header');
    const titleGroup = createEl('div', 'library-title-group');
    titleGroup.appendChild(createEl('h2', 'library-title', 'Game Library'));
    const countSpan = createEl('span', 'library-count');
    titleGroup.appendChild(countSpan);

    const controls = createEl('div', 'library-controls');
    const tabList = createEl('div', 'filter-tabs');
    tabList.setAttribute('role', 'tablist');
    tabList.setAttribute('aria-label', 'Filter by category');

    const gridContainer = createEl('div');

    const tabButtons = CATEGORIES.map((category) => {
      const tab = createEl('button', 'filter-tab', category);
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(state.selectedCategory === category));
      if (state.selectedCategory === category) tab.classList.add('is-active');
      tab.addEventListener('click', () => {
        state.selectedCategory = category;
        tabButtons.forEach((item) => {
          const isSel = item.category === category;
          item.btn.classList.toggle('is-active', isSel);
          item.btn.setAttribute('aria-selected', String(isSel));
        });
        updateHeaderState();
        renderGameCards(gridContainer, countSpan);
      });
      tabList.appendChild(tab);
      return { category, btn: tab };
    });

    const searchWrap = createEl('div', 'search-wrap');
    const searchIcon = createEl('span', 'search-icon');
    searchIcon.innerHTML = ICONS.search;
    const searchInput = createEl('input', 'search-input');
    searchInput.type = 'search';
    searchInput.value = state.searchQuery;
    searchInput.placeholder = 'Filter games...';
    searchInput.setAttribute('aria-label', 'Filter games');
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderGameCards(gridContainer, countSpan);
    });
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(searchInput);

    controls.appendChild(tabList);
    controls.appendChild(searchWrap);
    libHeader.appendChild(titleGroup);
    libHeader.appendChild(controls);

    librarySection.appendChild(libHeader);
    librarySection.appendChild(gridContainer);
    wrapper.appendChild(librarySection);

    renderGameCards(gridContainer, countSpan);
    return wrapper;
  }

  function renderActiveStageView(activeGame) {
    const parsed = parseIframeMarkup(activeGame.iframe, activeGame.title, state.catalogBase);
    if (!parsed) {
      const errPanel = createEl('div', 'status-panel is-error');
      errPanel.appendChild(createEl('h1', '', 'Invalid iframe configuration'));
      errPanel.appendChild(createEl('p', '', `Could not parse iframe for ${activeGame.title}.`));
      return errPanel;
    }

    const section = createEl('section', 'stage-section');
    section.setAttribute('aria-label', 'Active game stage');

    const toolbar = createEl('div', 'stage-toolbar');
    const headingGroup = createEl('div', 'stage-heading-group');

    const backBtn = createEl('button', 'btn-secondary');
    backBtn.type = 'button';
    backBtn.innerHTML = `${ICONS.arrowLeft}<span>All Games</span>`;
    backBtn.addEventListener('click', () => {
      state.activeGameId = null;
      renderMain();
    });

    const titleWrap = createEl('div');
    titleWrap.style.minWidth = '0';
    titleWrap.appendChild(createEl('h1', 'stage-title', activeGame.title));
    titleWrap.appendChild(
      createEl('p', 'stage-meta', `${activeGame.category} · ${activeGame.players} · ${activeGame.controls}`)
    );

    headingGroup.appendChild(backBtn);
    headingGroup.appendChild(titleWrap);

    const actions = createEl('div', 'stage-actions');
    const restartBtn = createEl('button', 'btn-secondary');
    restartBtn.type = 'button';
    restartBtn.innerHTML = `${ICONS.restart}<span>Restart</span>`;

    const fullscreenBtn = createEl('button', 'btn-secondary');
    fullscreenBtn.type = 'button';
    fullscreenBtn.innerHTML = `${ICONS.fullscreen}<span>Fullscreen</span>`;

    actions.appendChild(restartBtn);
    actions.appendChild(fullscreenBtn);
    toolbar.appendChild(headingGroup);
    toolbar.appendChild(actions);

    const frameWrap = createEl('div', 'iframe-frame');
    activeStageRef = frameWrap;

    function mountIframe() {
      frameWrap.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.className = parsed.extraClass ? `game-iframe ${parsed.extraClass}` : 'game-iframe';
      if (parsed.id) iframe.id = parsed.id;
      iframe.src = parsed.src;
      if (parsed.dataSrc) iframe.setAttribute('data-src', parsed.dataSrc);
      iframe.title = parsed.title;
      if (parsed.allow) iframe.setAttribute('allow', parsed.allow);
      if (parsed.sandbox) iframe.setAttribute('sandbox', parsed.sandbox);
      if (parsed.allowFullscreen) iframe.allowFullscreen = true;
      iframe.addEventListener('load', () => {
        try {
          iframe.focus();
        } catch (_) {
          // ignore cross-origin focus error
        }
      });
      frameWrap.appendChild(iframe);
    }

    restartBtn.addEventListener('click', mountIframe);
    fullscreenBtn.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else if (activeStageRef?.requestFullscreen) {
        activeStageRef.requestFullscreen().catch(() => {});
      }
    });

    mountIframe();

    const switcher = createEl('div', 'switcher-section');
    const switcherHeader = createEl('div', 'switcher-header');
    switcherHeader.appendChild(createEl('h2', '', 'Switch Game'));

    const inspectBtn = createEl('button', 'text-link-btn');
    inspectBtn.type = 'button';
    inspectBtn.innerHTML = `${ICONS.code}<span>Inspect games.json</span>`;
    inspectBtn.addEventListener('click', openJsonModal);
    switcherHeader.appendChild(inspectBtn);

    const switcherGrid = createEl('div', 'switcher-grid');
    getGames().forEach((game) => {
      const btn = createEl(
        'button',
        `switcher-card${game.id === activeGame.id ? ' is-current' : ''}`
      );
      btn.type = 'button';
      btn.addEventListener('click', () => launchGame(game.id));

      const thumb = createEl('div', 'switcher-thumb');
      thumb.appendChild(
        createThumbImg(resolveAssetPath(game.thumbnail, state.catalogBase), game.title)
      );

      btn.appendChild(thumb);
      btn.appendChild(createEl('p', 'switcher-name', game.title));
      btn.appendChild(createEl('p', 'switcher-cat', game.category));
      switcherGrid.appendChild(btn);
    });

    switcher.appendChild(switcherHeader);
    switcher.appendChild(switcherGrid);

    section.appendChild(toolbar);
    section.appendChild(frameWrap);
    section.appendChild(switcher);
    return section;
  }

  function renderMain() {
    if (!mainEl) return;
    mainEl.innerHTML = '';
    updateHeaderState();

    if (state.loading) {
      const panel = createEl('div', 'status-panel', 'Loading game catalog from games.json...');
      mainEl.appendChild(panel);
      return;
    }

    if (state.error) {
      const panel = createEl('div', 'status-panel is-error');
      panel.appendChild(createEl('h1', '', 'Could not load game catalog'));
      panel.appendChild(createEl('p', '', state.error));
      mainEl.appendChild(panel);
      return;
    }

    const active = getActiveGame();
    if (active) {
      mainEl.appendChild(renderActiveStageView(active));
    } else {
      mainEl.appendChild(renderLibraryView());
    }
  }

  function buildShell() {
    rootEl.innerHTML = '';
    shellEl = createEl('div', 'app-shell');

    // Header
    const header = createEl('header', 'site-header');
    const headerInner = createEl('div', 'header-inner');

    const brandBtn = createEl('button', 'brand-btn');
    brandBtn.type = 'button';
    const brandIcon = document.createElement('img');
    brandIcon.className = 'brand-icon';
    brandIcon.src = './assets/aistudio/images_622b2ad0.jpg';
    brandIcon.alt = '';
    brandIcon.referrerPolicy = 'no-referrer';
    brandIcon.addEventListener('error', () => {
      if (!brandIcon.dataset.fallbackTried) {
        brandIcon.dataset.fallbackTried = '1';
        brandIcon.src = './public/assets/aistudio/images_622b2ad0.jpg';
      } else {
        brandIcon.style.display = 'none';
      }
    });
    brandBtn.appendChild(brandIcon);
    brandBtn.appendChild(createEl('span', '', 'EdgarTapia Class'));
    brandBtn.addEventListener('click', () => {
      state.activeGameId = null;
      state.selectedCategory = 'All';
      renderMain();
    });

    const nav = createEl('nav', 'header-nav');
    nav.setAttribute('aria-label', 'Game categories');
    navButtons = CATEGORIES.map((category) => {
      const label = category === 'All' ? 'All Games' : category;
      const btn = createEl('button', 'nav-link', label);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        state.selectedCategory = category;
        state.activeGameId = null;
        renderMain();
        document.getElementById('game-library')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      nav.appendChild(btn);
      return { category, btn };
    });

    randomBtn = createEl('button', 'btn-primary');
    randomBtn.type = 'button';
    randomBtn.innerHTML = `${ICONS.shuffle}<span>Random Game</span>`;
    randomBtn.addEventListener('click', handleRandomGame);

    headerInner.appendChild(brandBtn);
    headerInner.appendChild(nav);
    headerInner.appendChild(randomBtn);
    header.appendChild(headerInner);

    // Main
    mainEl = createEl('main', 'main-content');

    // Footer
    const footer = createEl('footer', 'site-footer');
    const footerInner = createEl('div', 'footer-inner');
    footerCountEl = createEl('span', '', 'EdgarTapia Class · 0 HTML/JS/CSS games');
    const footerBtn = createEl('button', 'footer-link', 'games.json catalog');
    footerBtn.type = 'button';
    footerBtn.addEventListener('click', openJsonModal);
    footerInner.appendChild(footerCountEl);
    footerInner.appendChild(footerBtn);
    footer.appendChild(footerInner);

    // Modal
    modalBackdropEl = createEl('div', 'modal-backdrop hidden');
    modalBackdropEl.setAttribute('role', 'dialog');
    modalBackdropEl.setAttribute('aria-modal', 'true');
    modalBackdropEl.setAttribute('aria-labelledby', 'jsonModalTitle');
    modalBackdropEl.addEventListener('click', closeJsonModal);

    const dialog = createEl('div', 'modal-dialog');
    dialog.addEventListener('click', (e) => e.stopPropagation());

    const modalHeader = createEl('div', 'modal-header');
    const modalTitleWrap = createEl('div');
    const modalTitle = createEl('h2', '', 'games.json');
    modalTitle.id = 'jsonModalTitle';
    modalTitleWrap.appendChild(modalTitle);
    modalTitleWrap.appendChild(
      createEl('p', '', 'Each game entry stores its standalone iframe definition and metadata.')
    );

    const closeBtn = createEl('button', 'modal-close-btn');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close JSON viewer');
    closeBtn.innerHTML = ICONS.close;
    closeBtn.addEventListener('click', closeJsonModal);

    modalHeader.appendChild(modalTitleWrap);
    modalHeader.appendChild(closeBtn);

    modalCodeEl = createEl('pre', 'modal-code');

    dialog.appendChild(modalHeader);
    dialog.appendChild(modalCodeEl);
    modalBackdropEl.appendChild(dialog);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.showJsonModal) {
        closeJsonModal();
      }
    });

    shellEl.appendChild(header);
    shellEl.appendChild(mainEl);
    shellEl.appendChild(footer);
    shellEl.appendChild(modalBackdropEl);
    rootEl.appendChild(shellEl);
  }

  async function loadCatalog() {
    state.loading = true;
    state.error = null;
    renderMain();

    const candidates = [
      { url: './games.json', base: './' },
      { url: './public/games.json', base: './public/' },
    ];

    try {
      let loadedData = null;
      let loadedBase = './';
      let lastStatus = '';

      for (const candidate of candidates) {
        const res = await fetch(candidate.url);
        if (res.ok) {
          loadedData = await res.json();
          loadedBase = candidate.base;
          break;
        }
        lastStatus = String(res.status);
      }

      if (!loadedData) {
        throw new Error(`Unable to load games.json (${lastStatus || 'network error'})`);
      }

      state.catalog = loadedData;
      state.catalogBase = loadedBase;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to load game catalog';
    } finally {
      state.loading = false;
      renderMain();
    }
  }

  buildShell();
  loadCatalog();
}
