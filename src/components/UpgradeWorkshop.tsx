import React from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import {
  UPGRADE_DEFINITIONS,
  getComputedStats,
  getUpgradeCost,
} from '../data/upgrades';
import { UpgradeId, UpgradeLevels } from '../types/game';

interface UpgradeWorkshopProps {
  shards: number;
  upgrades: UpgradeLevels;
  onPurchase: (id: UpgradeId) => void;
}

export const UpgradeWorkshop: React.FC<UpgradeWorkshopProps> = ({
  shards,
  upgrades,
  onPurchase,
}) => {
  const stats = getComputedStats(upgrades);

  return (
    <section className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
            Foundry Upgrades
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Invest alloy shards earned in play to permanently improve ball impact, paddle geometry, and defensive systems.
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm font-mono tabular-nums">
          <span className="text-slate-400">Available Balance</span>
          <span className="text-lg font-bold text-amber-400">
            {shards.toLocaleString()} Shards
          </span>
        </div>
      </div>

      {/* Current rig summary strip */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="text-xs text-slate-400">Impact Power</div>
          <div className="mt-1 text-base font-mono font-semibold text-slate-100 tabular-nums">
            {stats.damage} DMG
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Paddle Width</div>
          <div className="mt-1 text-base font-mono font-semibold text-slate-100 tabular-nums">
            {stats.paddleWidth} px
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Ball Velocity</div>
          <div className="mt-1 text-base font-mono font-semibold text-slate-100 tabular-nums">
            {Math.round(stats.speedMultiplier * 100)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Floor Shields</div>
          <div className="mt-1 text-base font-mono font-semibold text-slate-100 tabular-nums">
            {stats.startingShields} / level
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Magnet Pull</div>
          <div className="mt-1 text-base font-mono font-semibold text-slate-100 tabular-nums">
            {stats.magnetRange > 0 ? `${stats.magnetRange} px` : 'Off'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Split Chance</div>
          <div className="mt-1 text-base font-mono font-semibold text-slate-100 tabular-nums">
            {Math.round(stats.splitChance * 100)}%
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {UPGRADE_DEFINITIONS.map((def) => {
          const level = upgrades[def.id];
          const isMaxed = level >= def.maxLevel;
          const cost = getUpgradeCost(def.id, level);
          const canAfford = cost !== null && shards >= cost;

          return (
            <div
              key={def.id}
              className="flex flex-col justify-between p-5 rounded-xl bg-[#131C2E] border border-slate-800"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 tabular-nums">
                  <span>Tier {level} / {def.maxLevel}</span>
                  <span className="text-amber-400">{def.formatNextDelta(level)}</span>
                </div>

                <h2 className="mt-2 text-lg font-semibold text-slate-100">
                  {def.name}
                </h2>
                <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                  {def.description}
                </p>

                {/* Tier progress bars */}
                <div className="mt-4 flex items-center gap-1.5" aria-label={`Level ${level} of ${def.maxLevel}`}>
                  {Array.from({ length: def.maxLevel }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 flex-1 rounded-sm ${
                        idx < level ? 'bg-amber-400' : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>

                <div className="mt-3 text-xs font-mono text-slate-300 tabular-nums">
                  Current: {def.formatStat(level)}
                </div>
              </div>

              <button
                type="button"
                disabled={isMaxed || !canAfford}
                onClick={() => onPurchase(def.id)}
                className={`mt-5 w-full py-2.5 px-4 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  isMaxed
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 cursor-default'
                    : canAfford
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isMaxed ? (
                  <>
                    <Check className="w-4 h-4" />
                    Max Level
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4" />
                    Upgrade · {cost} Shards
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
