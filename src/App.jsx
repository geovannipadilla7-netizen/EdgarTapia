/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Code2,
  Gamepad2,
  Maximize2,
  Play,
  RotateCcw,
  Search,
  Shuffle,
  X,
} from 'lucide-react';

const CATEGORIES = ['All', 'Arcade', 'Puzzle', 'Classics'];

function parseIframeMarkup(htmlString, fallbackTitle) {
  if (typeof window === 'undefined' || !htmlString) return null;
  const doc = new DOMParser().parseFromString(htmlString, 'text/html');
  const el = doc.querySelector('iframe');
  if (!el) return null;
  const src = el.getAttribute('src');
  if (!src) return null;
  return {
    src,
    title: el.getAttribute('title') || fallbackTitle,
    allow: el.getAttribute('allow') || undefined,
    sandbox: el.getAttribute('sandbox') || undefined,
  };
}

function GameThumbnail({ src, title }) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#131B2B] text-[#94A3B8]">
        <Gamepad2 className="h-8 w-8 text-[#F59E0B]" aria-hidden="true" />
        <span className="text-xs font-medium">{title}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${title} cover artwork`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
    />
  );
}

export default function App() {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGameId, setActiveGameId] = useState(null);
  const [iframeResetKey, setIframeResetKey] = useState(0);
  const [showJsonModal, setShowJsonModal] = useState(false);

  const stageContainerRef = useRef(null);
  const iframeRef = useRef(null);
  const libraryRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        setLoading(true);
        const res = await fetch('/games.json');
        if (!res.ok) {
          throw new Error(`Unable to load games.json (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) {
          setCatalog(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load game catalog');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const games = catalog?.games ?? [];

  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return games.filter((game) => {
      const matchesCategory = selectedCategory === 'All' || game.category === selectedCategory;
      const matchesQuery =
        !q ||
        game.title.toLowerCase().includes(q) ||
        game.description.toLowerCase().includes(q) ||
        game.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [games, selectedCategory, searchQuery]);

  const activeGame = useMemo(
    () => games.find((g) => g.id === activeGameId) ?? null,
    [games, activeGameId]
  );

  const parsedActiveIframe = useMemo(
    () => (activeGame ? parseIframeMarkup(activeGame.iframe, activeGame.title) : null),
    [activeGame]
  );

  const featuredGame = games[0] ?? null;

  function launchGame(gameId) {
    setActiveGameId(gameId);
    setIframeResetKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleNavCategory(category) {
    setSelectedCategory(category);
    setActiveGameId(null);
    requestAnimationFrame(() => {
      libraryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function handleRandomGame() {
    if (!games.length) return;
    const pool = activeGameId && games.length > 1 ? games.filter((g) => g.id !== activeGameId) : games;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    launchGame(choice.id);
  }

  function handleRestartGame() {
    setIframeResetKey((k) => k + 1);
  }

  function handleFullscreen() {
    const el = stageContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  }

  return (
    <div className="min-h-screen bg-[#0E131F] text-[#F8FAFC] flex flex-col">
      {/* Three-Zone Single-Row Top Bar */}
      <header className="border-b border-white/[0.08] bg-[#0E131F]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => {
              setActiveGameId(null);
              setSelectedCategory('All');
            }}
            className="font-display text-xl font-bold tracking-tight text-[#F8FAFC] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F59E0B]"
          >
            Arcade Shelf
          </button>

          {/* Zone 2: 4 Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Game categories">
            {CATEGORIES.map((category) => {
              const label = category === 'All' ? 'All Games' : category;
              const isActive = !activeGame && selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleNavCategory(category)}
                  className={`text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 pb-0.5 border-b-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F59E0B] ${
                    isActive
                      ? 'text-[#F8FAFC] border-[#F59E0B]'
                      : 'text-[#94A3B8] border-transparent hover:text-[#F8FAFC] hover:border-white/25'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleRandomGame}
              disabled={!games.length}
              className="inline-flex items-center gap-2 rounded-lg bg-[#F59E0B] px-4 py-2.5 text-sm font-semibold text-[#0E131F] whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 hover:bg-[#FBBF24] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B]"
            >
              <Shuffle className="h-4 w-4" aria-hidden="true" />
              <span>Random Game</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-8 md:py-10">
        {loading && (
          <div className="rounded-xl border border-white/[0.08] bg-[#171F2E] p-12 text-center">
            <p className="text-sm text-[#94A3B8]">Loading game catalog from games.json...</p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-500/30 bg-[#171F2E] p-8 text-center">
            <h1 className="font-display text-xl font-semibold text-[#F8FAFC]">
              Could not load game catalog
            </h1>
            <p className="mt-2 text-sm text-[#94A3B8]">{error}</p>
          </div>
        )}

        {!loading && !error && activeGame && parsedActiveIframe && (
          <section aria-label="Active game stage" className="space-y-8">
            {/* Stage Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveGameId(null)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#171F2E] px-4 py-2.5 text-sm font-medium text-[#F8FAFC] whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 hover:bg-[#1E293B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B]"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>All Games</span>
                </button>

                <div className="min-w-0">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-[#F8FAFC] truncate">
                    {activeGame.title}
                  </h1>
                  <p className="text-xs text-[#94A3B8] truncate">
                    <span>{activeGame.category}</span>
                    <span className="mx-2" aria-hidden="true">·</span>
                    <span>{activeGame.players}</span>
                    <span className="mx-2" aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{activeGame.controls}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleRestartGame}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#171F2E] px-4 py-2.5 text-sm font-medium text-[#E2E8F0] whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 hover:bg-[#1E293B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B]"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Restart</span>
                </button>
                <button
                  type="button"
                  onClick={handleFullscreen}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#171F2E] px-4 py-2.5 text-sm font-medium text-[#E2E8F0] whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 hover:bg-[#1E293B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B]"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                  <span>Fullscreen</span>
                </button>
              </div>
            </div>

            {/* Iframe Stage */}
            <div
              ref={stageContainerRef}
              className="w-full overflow-hidden rounded-xl border border-white/10 bg-[#0E131F]"
            >
              <iframe
                key={`${activeGame.id}-${iframeResetKey}`}
                ref={iframeRef}
                src={parsedActiveIframe.src}
                title={parsedActiveIframe.title}
                allow={parsedActiveIframe.allow}
                sandbox={parsedActiveIframe.sandbox}
                onLoad={() => iframeRef.current?.focus()}
                className="block h-[560px] w-full border-0 md:h-[640px]"
              />
            </div>

            {/* Quick Switcher Shelf */}
            <div className="border-t border-white/[0.08] pt-8">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
                  Switch Game
                </h2>
                <button
                  type="button"
                  onClick={() => setShowJsonModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer whitespace-nowrap"
                >
                  <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Inspect games.json</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {games.map((game) => {
                  const isCurrent = game.id === activeGame.id;
                  return (
                    <button
                      key={game.id}
                      type="button"
                      onClick={() => launchGame(game.id)}
                      className={`group text-left rounded-xl border p-2.5 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B] ${
                        isCurrent
                          ? 'border-[#F59E0B] bg-[#1E293B]'
                          : 'border-white/[0.08] bg-[#171F2E] hover:border-white/20 hover:bg-[#1E293B]'
                      }`}
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-[#131B2B]">
                        <GameThumbnail src={game.thumbnail} title={game.title} />
                      </div>
                      <p className="mt-2 truncate text-sm font-semibold text-[#F8FAFC]">
                        {game.title}
                      </p>
                      <p className="truncate text-xs text-[#94A3B8]">{game.category}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {!loading && !error && !activeGame && (
          <div className="space-y-12">
            {/* Hero Spotlight */}
            {featuredGame && (
              <section className="grid grid-cols-1 items-stretch gap-8 rounded-2xl border border-white/[0.08] bg-[#171F2E] p-6 md:p-8 lg:grid-cols-12">
                <div className="flex flex-col justify-between gap-6 lg:col-span-6">
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-[#94A3B8]">
                      <span>Featured Game</span>
                      <span className="mx-2" aria-hidden="true">·</span>
                      <span>{featuredGame.category}</span>
                      <span className="mx-2" aria-hidden="true">·</span>
                      <span>{featuredGame.controls}</span>
                    </p>
                    <h1
                      className="font-display text-3xl font-bold tracking-tight text-[#F8FAFC] sm:text-4xl lg:text-5xl"
                      style={{ textWrap: 'balance' }}
                    >
                      Classic browser games, ready to play
                    </h1>
                    <p className="max-w-xl text-base leading-relaxed text-[#CBD5E1]">
                      Six handcrafted arcade and puzzle games built with pure HTML, CSS, and JavaScript. Every title loads directly from its iframe entry in <code className="font-mono-tabular text-sm text-[#F8FAFC]">games.json</code>.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => launchGame(featuredGame.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#F59E0B] px-6 py-3 text-sm font-semibold text-[#0E131F] whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 hover:bg-[#FBBF24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B]"
                    >
                      <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                      <span>Play {featuredGame.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowJsonModal(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#1E293B] px-5 py-3 text-sm font-medium text-[#E2E8F0] whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 hover:bg-[#293548] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B]"
                    >
                      <Code2 className="h-4 w-4" aria-hidden="true" />
                      <span>View games.json</span>
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <button
                    type="button"
                    onClick={() => launchGame(featuredGame.id)}
                    aria-label={`Launch ${featuredGame.title}`}
                    className="group relative block h-full min-h-[240px] w-full overflow-hidden rounded-xl border border-white/10 bg-[#131B2B] text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B]"
                  >
                    <GameThumbnail src={featuredGame.thumbnail} title={featuredGame.title} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
                      <div>
                        <p className="font-display text-xl font-bold text-[#F8FAFC]">
                          {featuredGame.title}
                        </p>
                        <p className="mt-1 text-xs text-[#CBD5E1] line-clamp-1">
                          {featuredGame.description}
                        </p>
                      </div>
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#F59E0B] text-[#0E131F] transition-transform duration-150 group-hover:scale-105">
                        <Play className="h-5 w-5 fill-current" aria-hidden="true" />
                      </span>
                    </div>
                  </button>
                </div>
              </section>
            )}

            {/* Game Library Section */}
            <section ref={libraryRef} aria-label="Game Library" className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-baseline gap-3">
                  <h2 className="font-display text-2xl font-bold tracking-tight text-[#F8FAFC]">
                    Game Library
                  </h2>
                  <span className="font-mono-tabular text-sm text-[#94A3B8]">
                    {filteredGames.length} {filteredGames.length === 1 ? 'title' : 'titles'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Category Segmented Filter */}
                  <div
                    role="tablist"
                    aria-label="Filter by category"
                    className="flex items-center gap-1 rounded-lg bg-[#171F2E] p-1 border border-white/[0.08]"
                  >
                    {CATEGORIES.map((category) => {
                      const active = selectedCategory === category;
                      return (
                        <button
                          key={category}
                          role="tab"
                          aria-selected={active}
                          type="button"
                          onClick={() => setSelectedCategory(category)}
                          className={`rounded-md px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#F59E0B] ${
                            active
                              ? 'bg-[#F59E0B] text-[#0E131F]'
                              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                          }`}
                        >
                          {category}
                        </button>
                      );
                    })}
                  </div>

                  {/* Search Field */}
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter games..."
                      aria-label="Filter games"
                      className="w-48 rounded-lg border border-white/[0.08] bg-[#171F2E] py-2 pl-9 pr-3 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:border-[#F59E0B] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {filteredGames.length === 0 ? (
                <div className="rounded-xl border border-white/[0.08] bg-[#171F2E] p-10 text-center">
                  <p className="text-sm text-[#CBD5E1]">
                    No games match your current filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setSearchQuery('');
                    }}
                    className="mt-4 rounded-lg bg-[#1E293B] px-4 py-2 text-xs font-semibold text-[#F8FAFC] hover:bg-[#293548] cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredGames.map((game) => (
                    <article
                      key={game.id}
                      className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#171F2E] transition-colors duration-150 hover:border-white/20"
                    >
                      <button
                        type="button"
                        onClick={() => launchGame(game.id)}
                        aria-label={`Play ${game.title}`}
                        className="aspect-[4/3] w-full overflow-hidden bg-[#131B2B] cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#F59E0B]"
                      >
                        <GameThumbnail src={game.thumbnail} title={game.title} />
                      </button>

                      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 text-xs text-[#94A3B8]">
                            <span>
                              {game.category} · {game.players}
                            </span>
                            <span className="truncate font-mono-tabular">{game.controls}</span>
                          </div>
                          <h3 className="font-display text-xl font-bold text-[#F8FAFC]">
                            {game.title}
                          </h3>
                          <p className="text-sm leading-relaxed text-[#CBD5E1] line-clamp-2">
                            {game.description}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => launchGame(game.id)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E293B] px-4 py-2.5 text-sm font-semibold text-[#F8FAFC] whitespace-nowrap cursor-pointer transition-colors duration-150 hover:bg-[#F59E0B] hover:text-[#0E131F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B]"
                        >
                          <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                          <span>Play Game</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-white/[0.08] py-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 text-xs text-[#94A3B8]">
          <span>Arcade Shelf · {games.length} HTML/JS/CSS games</span>
          <button
            type="button"
            onClick={() => setShowJsonModal(true)}
            className="hover:text-[#F8FAFC] cursor-pointer underline underline-offset-4"
          >
            games.json catalog
          </button>
        </div>
      </footer>

      {/* JSON Catalog Inspector Modal */}
      {showJsonModal && catalog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="jsonModalTitle"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          onClick={() => setShowJsonModal(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/15 bg-[#171F2E]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
              <div>
                <h2 id="jsonModalTitle" className="font-display text-lg font-bold text-[#F8FAFC]">
                  games.json
                </h2>
                <p className="text-xs text-[#94A3B8]">
                  Each game entry stores its standalone iframe definition and metadata.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                aria-label="Close JSON viewer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <pre className="overflow-auto p-5 text-xs leading-relaxed text-[#E2E8F0] font-mono-tabular">
              {JSON.stringify(catalog, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
