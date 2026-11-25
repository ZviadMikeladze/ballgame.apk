import React from 'react';
import { Lock, Play, Star } from 'lucide-react';
import { LEVELS } from '../data/levels';
import { LevelProgress } from '../types/game';

interface LevelSelectProps {
  levelProgress: Record<number, LevelProgress>;
  currentLevelId: number;
  onSelectLevel: (levelId: number) => void;
}

export const LevelSelect: React.FC<LevelSelectProps> = ({
  levelProgress,
  currentLevelId,
  onSelectLevel,
}) => {
  const totalStars = Object.values(levelProgress).reduce((sum, p) => sum + p.stars, 0);
  const maxStars = LEVELS.length * 3;
  const unlockedCount = Object.values(levelProgress).filter((p) => p.unlocked).length;

  return (
    <section className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
            Arena Sectors
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Select any unlocked arena to clear blocks, earn alloy shards, and set faster par times.
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-300 font-mono tabular-nums">
          <span>{unlockedCount} / {LEVELS.length} Unlocked</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="inline-flex items-center gap-1.5 text-amber-400">
            <Star className="w-4 h-4 fill-amber-400" />
            {totalStars} / {maxStars} Stars
          </span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {LEVELS.map((lvl) => {
          const prog = levelProgress[lvl.id] ?? {
            unlocked: lvl.id === 1,
            stars: 0,
            bestScore: 0,
            bestTimeSeconds: null,
          };
          const isCurrent = lvl.id === currentLevelId;

          return (
            <div
              key={lvl.id}
              className={`flex flex-col justify-between p-5 rounded-xl border transition-colors ${
                prog.unlocked
                  ? isCurrent
                    ? 'bg-[#172136] border-amber-500/60'
                    : 'bg-[#131C2E] border-slate-800 hover:border-slate-700'
                  : 'bg-[#0F172A] border-slate-800/60 opacity-65'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 tabular-nums">
                  <span>Sector 0{lvl.id}</span>
                  <span>+{lvl.completionBonusShards} Shards</span>
                </div>

                <h2 className="mt-2 text-lg font-semibold text-slate-100">
                  {lvl.name}
                </h2>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed min-h-[2.5rem]">
                  {lvl.mechanicSummary}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
                  <div className="flex items-center gap-1" aria-label={`${prog.stars} of 3 stars`}>
                    {[1, 2, 3].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= prog.stars
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <span>
                    {prog.bestScore > 0 ? `${prog.bestScore.toLocaleString()} pts` : `Par ${lvl.parTimeSeconds}s`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={!prog.unlocked}
                onClick={() => onSelectLevel(lvl.id)}
                className={`mt-5 w-full py-2.5 px-4 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  prog.unlocked
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer'
                    : 'bg-slate-800/70 text-slate-500 cursor-not-allowed'
                }`}
              >
                {prog.unlocked ? (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    {prog.stars > 0 ? 'Replay Level' : 'Start Level'}
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Locked
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
