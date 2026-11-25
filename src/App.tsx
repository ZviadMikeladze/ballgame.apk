import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Star,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { GameCanvas } from './components/GameCanvas';
import { HowToPlay } from './components/HowToPlay';
import { LevelSelect } from './components/LevelSelect';
import { UpgradeWorkshop } from './components/UpgradeWorkshop';
import { LEVELS, getLevelById } from './data/levels';
import {
  DEFAULT_UPGRADES,
  getComputedStats,
  getUpgradeCost,
} from './data/upgrades';
import {
  AppView,
  LevelProgress,
  LevelResult,
  LiveHUDState,
  PlayOverlayState,
  SaveData,
  UpgradeId,
} from './types/game';
import { sound } from './utils/sound';

const STORAGE_KEY = 'ricochet_foundry_save_v1';

function createInitialSaveData(): SaveData {
  const levels: Record<number, LevelProgress> = {};
  for (const lvl of LEVELS) {
    levels[lvl.id] = {
      unlocked: lvl.id === 1,
      stars: 0,
      bestScore: 0,
      bestTimeSeconds: null,
    };
  }
  return {
    shards: 0,
    totalBricksBroken: 0,
    upgrades: { ...DEFAULT_UPGRADES },
    levels,
    muted: false,
  };
}

function loadSaveData(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialSaveData();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = createInitialSaveData();

    const mergedLevels: Record<number, LevelProgress> = { ...base.levels };
    if (parsed.levels) {
      for (const lvl of LEVELS) {
        const savedLvl = parsed.levels[lvl.id];
        if (savedLvl) {
          mergedLevels[lvl.id] = {
            unlocked: lvl.id === 1 ? true : Boolean(savedLvl.unlocked),
            stars: Number(savedLvl.stars) || 0,
            bestScore: Number(savedLvl.bestScore) || 0,
            bestTimeSeconds:
              typeof savedLvl.bestTimeSeconds === 'number'
                ? savedLvl.bestTimeSeconds
                : null,
          };
        }
      }
    }

    return {
      shards: typeof parsed.shards === 'number' ? Math.max(0, parsed.shards) : 0,
      totalBricksBroken:
        typeof parsed.totalBricksBroken === 'number'
          ? Math.max(0, parsed.totalBricksBroken)
          : 0,
      upgrades: { ...DEFAULT_UPGRADES, ...(parsed.upgrades ?? {}) },
      levels: mergedLevels,
      muted: Boolean(parsed.muted),
    };
  } catch {
    return createInitialSaveData();
  }
}

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const [view, setView] = useState<AppView>('TITLE');
  const [currentLevelId, setCurrentLevelId] = useState<number>(() => {
    const initial = loadSaveData();
    const highestUnlocked = LEVELS.filter((l) => initial.levels[l.id]?.unlocked).pop();
    return highestUnlocked?.id ?? 1;
  });
  const [overlayState, setOverlayState] = useState<PlayOverlayState>('NONE');
  const [runKey, setRunKey] = useState<number>(1);
  const [lastResult, setLastResult] = useState<LevelResult | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  const currentLevel = useMemo(() => getLevelById(currentLevelId), [currentLevelId]);
  const computedStats = useMemo(() => getComputedStats(save.upgrades), [save.upgrades]);

  const [hud, setHud] = useState<LiveHUDState>(() => ({
    levelId: currentLevel.id,
    levelName: currentLevel.name,
    score: 0,
    shardsEarned: 0,
    lives: 3,
    maxLives: 3,
    shieldCharges: computedStats.startingShields,
    maxShieldCharges: Math.max(computedStats.startingShields, 3),
    bricksRemaining: currentLevel.bricks.filter((b) => b.kind !== 'obsidian').length,
    totalBreakableBricks: currentLevel.bricks.filter((b) => b.kind !== 'obsidian').length,
    elapsedSeconds: 0,
    combo: 0,
    activeBuffs: { widePaddleRemaining: 0, powerSurgeRemaining: 0 },
    awaitingLaunch: true,
  }));

  useEffect(() => {
    sound.setMuted(save.muted);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch {
      // Ignore storage quota errors
    }
  }, [save]);

  const startLevel = useCallback((levelId: number) => {
    setCurrentLevelId(levelId);
    setOverlayState('NONE');
    setLastResult(null);
    setRunKey((k) => k + 1);
    setView('PLAYING');
  }, []);

  const handleRestartLevel = useCallback(() => {
    setOverlayState('NONE');
    setLastResult(null);
    setRunKey((k) => k + 1);
  }, []);

  const handleTogglePause = useCallback(() => {
    setOverlayState((prev) => {
      if (prev === 'NONE') return 'PAUSED';
      if (prev === 'PAUSED') return 'NONE';
      return prev;
    });
  }, []);

  const handleLevelEnd = useCallback((result: LevelResult) => {
    setLastResult(result);
    setOverlayState(result.won ? 'LEVEL_COMPLETE' : 'GAME_OVER');

    setSave((prev) => {
      const gainedShards = result.shardsEarned + (result.won ? result.completionBonus : 0);
      const nextLevels = { ...prev.levels };
      const existing = nextLevels[result.levelId] ?? {
        unlocked: true,
        stars: 0,
        bestScore: 0,
        bestTimeSeconds: null,
      };

      if (result.won) {
        nextLevels[result.levelId] = {
          unlocked: true,
          stars: Math.max(existing.stars, result.starsEarned),
          bestScore: Math.max(existing.bestScore, result.score),
          bestTimeSeconds:
            existing.bestTimeSeconds === null
              ? result.elapsedSeconds
              : Math.min(existing.bestTimeSeconds, result.elapsedSeconds),
        };

        const nextLevelId = result.levelId + 1;
        if (nextLevelId <= LEVELS.length) {
          const nextExisting = nextLevels[nextLevelId] ?? {
            unlocked: true,
            stars: 0,
            bestScore: 0,
            bestTimeSeconds: null,
          };
          nextLevels[nextLevelId] = {
            ...nextExisting,
            unlocked: true,
          };
        }
      }

      return {
        ...prev,
        shards: prev.shards + gainedShards,
        totalBricksBroken: prev.totalBricksBroken + result.bricksBroken,
        levels: nextLevels,
      };
    });
  }, []);

  const handlePurchaseUpgrade = useCallback((id: UpgradeId) => {
    setSave((prev) => {
      const currentLvl = prev.upgrades[id];
      const cost = getUpgradeCost(id, currentLvl);
      if (cost === null || prev.shards < cost) return prev;
      sound.upgradePurchase();
      return {
        ...prev,
        shards: prev.shards - cost,
        upgrades: {
          ...prev.upgrades,
          [id]: currentLvl + 1,
        },
      };
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    setSave((prev) => ({ ...prev, muted: !prev.muted }));
  }, []);

  const handleResetSave = useCallback(() => {
    const fresh = createInitialSaveData();
    setSave(fresh);
    setCurrentLevelId(1);
    setConfirmReset(false);
    setOverlayState('NONE');
    setLastResult(null);
    setView('TITLE');
  }, []);

  const handleNavigate = (target: AppView) => {
    if (view === 'PLAYING' && target !== 'PLAYING' && overlayState === 'NONE') {
      setOverlayState('PAUSED');
    }
    setView(target);
  };

  const totalStars = Object.values(save.levels).reduce((acc, l) => acc + l.stars, 0);
  const unlockedSectors = Object.values(save.levels).filter((l) => l.unlocked).length;
  const hasNextLevel = currentLevel.id < LEVELS.length;

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1120] text-slate-100">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="border-b border-slate-800/90 bg-[#0B1120]/95 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleNavigate('TITLE')}
            className="font-display text-lg font-bold tracking-tight text-slate-100 hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ricochet Foundry
          </button>

          {/* Zone 2: Clean single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                if (view === 'PLAYING') return;
                startLevel(currentLevelId);
              }}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'PLAYING'
                  ? 'border-amber-400 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              Arena
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('LEVELS')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'LEVELS'
                  ? 'border-amber-400 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              Levels
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('UPGRADES')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'UPGRADES'
                  ? 'border-amber-400 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              Upgrades
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('GUIDE')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'GUIDE'
                  ? 'border-amber-400 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              How to Play
            </button>
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                if (view === 'PLAYING') {
                  handleTogglePause();
                } else {
                  startLevel(currentLevelId);
                }
              }}
              className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              {view === 'PLAYING'
                ? overlayState === 'PAUSED'
                  ? 'Resume'
                  : 'Pause'
                : `Play Sector 0${currentLevelId}`}
            </button>
          </div>
        </div>

        {/* Mobile compact nav row */}
        <div className="md:hidden border-t border-slate-800/80 px-4 py-2 flex items-center justify-around text-xs font-medium text-slate-300">
          <button type="button" onClick={() => startLevel(currentLevelId)} className="px-2 py-1 whitespace-nowrap">
            Arena
          </button>
          <button type="button" onClick={() => handleNavigate('LEVELS')} className="px-2 py-1 whitespace-nowrap">
            Levels
          </button>
          <button type="button" onClick={() => handleNavigate('UPGRADES')} className="px-2 py-1 whitespace-nowrap">
            Upgrades
          </button>
          <button type="button" onClick={() => handleNavigate('GUIDE')} className="px-2 py-1 whitespace-nowrap">
            Guide
          </button>
        </div>
      </header>

      <main className="flex-1">
        {view === 'TITLE' && (
          <section className="max-w-6xl mx-auto px-6 py-12 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-7">
                <div className="text-xs font-mono text-amber-400 tracking-wide">
                  8 Kinetic Arenas · Persistent Upgrade Workshop
                </div>
                <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-slate-100 leading-[1.1] max-w-xl [text-wrap:balance]">
                  Shatter armored vaults with precision ricochets.
                </h1>
                <p className="mt-4 text-base text-slate-400 max-w-xl leading-relaxed">
                  Steer your kinetic deflector paddle, trigger explosive chain reactions, warp through phase portals, and invest collected alloy shards into permanent ball and shield upgrades.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => startLevel(currentLevelId)}
                    className="px-6 py-3 rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold hover:bg-amber-400 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {save.totalBricksBroken > 0
                      ? `Continue Sector 0${currentLevelId}`
                      : 'Start Level 01'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('LEVELS')}
                    className="px-5 py-3 rounded-lg bg-[#131C2E] border border-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Select Level
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('UPGRADES')}
                    className="px-5 py-3 rounded-lg bg-[#131C2E] border border-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Wrench className="w-4 h-4 text-amber-400" />
                    Upgrades
                  </button>
                </div>

                {/* Unboxed typographic progress metrics */}
                <div className="mt-10 pt-6 border-t border-slate-800/80 grid grid-cols-3 gap-6 max-w-lg">
                  <div>
                    <div className="text-xs text-slate-400">Shard Balance</div>
                    <div className="mt-1 text-xl font-mono font-bold text-amber-400 tabular-nums">
                      {save.shards.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Sectors Unlocked</div>
                    <div className="mt-1 text-xl font-mono font-bold text-slate-100 tabular-nums">
                      {unlockedSectors} / {LEVELS.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Stars Earned</div>
                    <div className="mt-1 text-xl font-mono font-bold text-slate-100 tabular-nums">
                      {totalStars} / {LEVELS.length * 3}
                    </div>
                  </div>
                </div>
              </div>

              {/* Clean interactive arena schematic preview card */}
              <div className="lg:col-span-5">
                <div className="p-6 rounded-xl bg-[#131C2E] border border-slate-800">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Current Rig Configuration</span>
                    <span className="text-amber-400">Ready</span>
                  </div>

                  <div className="mt-5 space-y-3.5 text-sm">
                    <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Impact Power</span>
                      <span className="font-mono font-semibold text-slate-100 tabular-nums">
                        {computedStats.damage} DMG / hit
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Paddle Span</span>
                      <span className="font-mono font-semibold text-slate-100 tabular-nums">
                        {computedStats.paddleWidth} px
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Launch Velocity</span>
                      <span className="font-mono font-semibold text-slate-100 tabular-nums">
                        {Math.round(computedStats.speedMultiplier * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Floor Barrier Charges</span>
                      <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                        {computedStats.startingShields} / level
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-slate-400">Next Target</span>
                      <span className="font-medium text-slate-100">
                        0{currentLevel.id}. {currentLevel.name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {view === 'PLAYING' && (
          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,760px)_280px] gap-6 justify-center items-start">
              {/* Arena Canvas + Modal Overlays */}
              <div className="relative flex justify-center">
                <GameCanvas
                  level={currentLevel}
                  upgrades={save.upgrades}
                  overlayState={overlayState}
                  runKey={runKey}
                  onHudUpdate={setHud}
                  onLevelEnd={handleLevelEnd}
                  onTogglePause={handleTogglePause}
                />

                {overlayState === 'PAUSED' && (
                  <div className="absolute inset-0 rounded-lg bg-slate-950/80 backdrop-blur-[2px] flex items-center justify-center p-6">
                    <div className="w-full max-w-sm p-6 rounded-xl bg-[#131C2E] border border-slate-700 text-center">
                      <h2 className="text-2xl font-semibold text-slate-100">
                        Run Paused
                      </h2>
                      <p className="mt-1.5 text-sm text-slate-400">
                        Sector 0{currentLevel.id} · {currentLevel.name}
                      </p>

                      <div className="mt-6 flex flex-col gap-2.5">
                        <button
                          type="button"
                          onClick={() => setOverlayState('NONE')}
                          className="w-full py-2.5 px-4 rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold hover:bg-amber-400 transition-colors cursor-pointer"
                        >
                          Resume
                        </button>
                        <button
                          type="button"
                          onClick={handleRestartLevel}
                          className="w-full py-2.5 px-4 rounded-lg bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          Restart Level
                        </button>
                        <button
                          type="button"
                          onClick={() => setView('UPGRADES')}
                          className="w-full py-2.5 px-4 rounded-lg bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          Open Upgrades
                        </button>
                        <button
                          type="button"
                          onClick={() => setView('LEVELS')}
                          className="w-full py-2.5 px-4 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Change Level
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {overlayState === 'LEVEL_COMPLETE' && lastResult && (
                  <div className="absolute inset-0 rounded-lg bg-slate-950/35 flex items-center justify-center p-6">
                    <div className="w-full max-w-md p-6 rounded-xl bg-[#131C2E]/95 border border-slate-700 shadow-2xl">
                      <div className="text-xs font-mono text-emerald-400 text-center">
                        Sector 0{lastResult.levelId} Cleared
                      </div>
                      <h2 className="mt-1 text-2xl font-semibold text-slate-100 text-center">
                        {currentLevel.name} Complete
                      </h2>

                      {/* Earned Stars */}
                      <div className="mt-4 flex items-center justify-center gap-2">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className={`w-7 h-7 ${
                              s <= lastResult.starsEarned
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>

                      <div className="mt-5 space-y-2.5 text-sm border-t border-b border-slate-800 py-4">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Final Score</span>
                          <span className="font-mono font-semibold text-slate-100 tabular-nums">
                            {lastResult.score.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Clear Time</span>
                          <span className="font-mono text-slate-200 tabular-nums">
                            {lastResult.elapsedSeconds}s (Par {currentLevel.parTimeSeconds}s)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Shards Earned</span>
                          <span className="font-mono font-semibold text-amber-400 tabular-nums">
                            +{lastResult.shardsEarned} collected · +{lastResult.completionBonus} bonus
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-2.5">
                        {hasNextLevel ? (
                          <button
                            type="button"
                            onClick={() => startLevel(currentLevel.id + 1)}
                            className="w-full py-2.5 px-4 rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold hover:bg-amber-400 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                          >
                            Next Level (Sector 0{currentLevel.id + 1})
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setView('LEVELS')}
                            className="w-full py-2.5 px-4 rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold hover:bg-amber-400 transition-colors cursor-pointer"
                          >
                            All 8 Sectors Cleared · View Levels
                          </button>
                        )}
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setView('UPGRADES')}
                            className="py-2.5 px-4 rounded-lg bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 transition-colors cursor-pointer"
                          >
                            Upgrades
                          </button>
                          <button
                            type="button"
                            onClick={handleRestartLevel}
                            className="py-2.5 px-4 rounded-lg bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 transition-colors cursor-pointer"
                          >
                            Play Again
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {overlayState === 'GAME_OVER' && lastResult && (
                  <div className="absolute inset-0 rounded-lg bg-slate-950/82 backdrop-blur-[2px] flex items-center justify-center p-6">
                    <div className="w-full max-w-md p-6 rounded-xl bg-[#131C2E] border border-slate-700">
                      <div className="text-xs font-mono text-red-400 text-center">
                        Out of Kinetic Balls
                      </div>
                      <h2 className="mt-1 text-2xl font-semibold text-slate-100 text-center">
                        Sector 0{lastResult.levelId} Failed
                      </h2>
                      <p className="mt-1.5 text-xs text-slate-400 text-center">
                        You keep all alloy shards collected during this attempt.
                      </p>

                      <div className="mt-5 space-y-2.5 text-sm border-t border-b border-slate-800 py-4">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Score</span>
                          <span className="font-mono font-semibold text-slate-100 tabular-nums">
                            {lastResult.score.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Blocks Shattered</span>
                          <span className="font-mono text-slate-200 tabular-nums">
                            {lastResult.bricksBroken}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Shards Kept</span>
                          <span className="font-mono font-semibold text-amber-400 tabular-nums">
                            +{lastResult.shardsEarned} Shards
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-2.5">
                        <button
                          type="button"
                          onClick={handleRestartLevel}
                          className="w-full py-2.5 px-4 rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold hover:bg-amber-400 transition-colors cursor-pointer"
                        >
                          Play Again
                        </button>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setView('UPGRADES')}
                            className="py-2.5 px-4 rounded-lg bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 transition-colors cursor-pointer"
                          >
                            Upgrades
                          </button>
                          <button
                            type="button"
                            onClick={() => setView('LEVELS')}
                            className="py-2.5 px-4 rounded-lg bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 transition-colors cursor-pointer"
                          >
                            Levels
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Unobtrusive Side HUD Panel */}
              <aside className="w-full p-5 rounded-xl bg-[#131C2E] border border-slate-800 space-y-5">
                <div className="pb-4 border-b border-slate-800/80">
                  <div className="text-xs font-mono text-slate-400">
                    Sector 0{hud.levelId} · {currentLevel.subtitle}
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-100">
                    {hud.levelName}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-400">Score</div>
                    <div className="mt-0.5 text-lg font-mono font-bold text-slate-100 tabular-nums">
                      {hud.score.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Time</div>
                    <div className="mt-0.5 text-lg font-mono font-bold text-slate-100 tabular-nums">
                      {hud.elapsedSeconds}s
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Balls Left</div>
                    <div className="mt-0.5 text-base font-mono font-semibold text-slate-100 tabular-nums">
                      {hud.lives} / {hud.maxLives}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Run Shards</div>
                    <div className="mt-0.5 text-base font-mono font-semibold text-amber-400 tabular-nums">
                      +{hud.shardsEarned}
                    </div>
                  </div>
                </div>

                {/* Bricks Remaining Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
                    <span>Blocks Remaining</span>
                    <span>
                      {hud.bricksRemaining} / {hud.totalBreakableBricks}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-150"
                      style={{
                        width: `${
                          hud.totalBreakableBricks > 0
                            ? ((hud.totalBreakableBricks - hud.bricksRemaining) /
                                hud.totalBreakableBricks) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Shield & Active Buffs */}
                <div className="pt-4 border-t border-slate-800/80 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1.5 text-slate-300">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      Floor Shields
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      {hud.shieldCharges} active
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-mono tabular-nums">
                    <span className="text-slate-400">Total Bank</span>
                    <span className="text-amber-400 font-semibold">
                      {(save.shards + hud.shardsEarned).toLocaleString()} Shards
                    </span>
                  </div>

                  {hud.activeBuffs.widePaddleRemaining > 0 && (
                    <div className="flex items-center justify-between font-mono text-emerald-400 tabular-nums">
                      <span>Wide Paddle</span>
                      <span>{hud.activeBuffs.widePaddleRemaining}s</span>
                    </div>
                  )}

                  {hud.activeBuffs.powerSurgeRemaining > 0 && (
                    <div className="flex items-center justify-between font-mono text-red-400 tabular-nums">
                      <span>Impact Surge (+2)</span>
                      <span>{hud.activeBuffs.powerSurgeRemaining}s</span>
                    </div>
                  )}
                </div>

                {/* Quick Controls */}
                <div className="pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className="py-2 px-3 rounded-lg bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    {overlayState === 'PAUSED' ? (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        Pause
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleRestartLevel}
                    className="py-2 px-3 rounded-lg bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restart
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className="py-2 px-3 rounded-lg bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    {save.muted ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                        Muted
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                        Sound On
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigate('UPGRADES')}
                    className="py-2 px-3 rounded-lg bg-slate-800 text-amber-400 text-xs font-medium hover:bg-slate-700 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Upgrades
                  </button>
                </div>
              </aside>
            </div>
          </section>
        )}

        {view === 'LEVELS' && (
          <LevelSelect
            levelProgress={save.levels}
            currentLevelId={currentLevelId}
            onSelectLevel={startLevel}
          />
        )}

        {view === 'UPGRADES' && (
          <UpgradeWorkshop
            shards={save.shards}
            upgrades={save.upgrades}
            onPurchase={handlePurchaseUpgrade}
          />
        )}

        {view === 'GUIDE' && (
          <HowToPlay onStartPlay={() => startLevel(currentLevelId)} />
        )}
      </main>

      {/* Quiet footer with real user actions only */}
      <footer className="border-t border-slate-800/70 py-4 px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>Ricochet Foundry</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {save.totalBricksBroken.toLocaleString()} blocks shattered
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleToggleMute}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              {save.muted ? 'Unmute Audio' : 'Mute Audio'}
            </button>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="hover:text-red-400 transition-colors cursor-pointer"
              >
                Reset Save
              </button>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span className="text-red-400">Erase all progress?</span>
                <button
                  type="button"
                  onClick={handleResetSave}
                  className="text-red-300 underline hover:text-red-200 cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="text-slate-400 underline hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
