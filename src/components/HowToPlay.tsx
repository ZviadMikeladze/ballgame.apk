import React from 'react';
import { Play } from 'lucide-react';

interface HowToPlayProps {
  onStartPlay: () => void;
}

export const HowToPlay: React.FC<HowToPlayProps> = ({ onStartPlay }) => {
  return (
    <section className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
            Field Manual
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Controls, block classifications, arena hazards, and upgrade strategy.
          </p>
        </div>

        <button
          type="button"
          onClick={onStartPlay}
          className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-medium hover:bg-amber-400 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          Return to Arena
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Controls & Ricochet Aim</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-slate-300 leading-relaxed">
            <li>
              <strong className="text-slate-100">Paddle Movement:</strong> Move your mouse or drag anywhere inside the arena, or hold <span className="font-mono text-amber-400">A / D</span> or <span className="font-mono text-amber-400">Left / Right</span> arrows.
            </li>
            <li>
              <strong className="text-slate-100">Launch Ball:</strong> Click the arena or press <span className="font-mono text-amber-400">Space</span> to fire the ball along the oscillating sightline.
            </li>
            <li>
              <strong className="text-slate-100">Angle Control:</strong> Hitting near the paddle edges sends the ball at sharper horizontal angles; hitting center sends it steeply upward.
            </li>
            <li>
              <strong className="text-slate-100">Pause:</strong> Press <span className="font-mono text-amber-400">P</span> or <span className="font-mono text-amber-400">Esc</span> anytime during a run.
            </li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold text-slate-100">Field Pickups</h2>
          <div className="mt-3 space-y-2.5 text-sm text-slate-300">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs font-bold text-sky-400 w-16 shrink-0">MULTI</span>
              <span>Splits active trajectory into additional kinetic balls (up to 5).</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs font-bold text-emerald-400 w-16 shrink-0">WIDE</span>
              <span>Extends paddle width by 44px for 12 seconds.</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs font-bold text-red-400 w-16 shrink-0">SURGE</span>
              <span>Adds +2 impact damage per hit for 10 seconds.</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs font-bold text-teal-400 w-16 shrink-0">SHIELD</span>
              <span>Restores 1 floor safety barrier charge to save missed balls.</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-100">Block Types & Hazards</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-300">
            <div className="p-3.5 rounded-lg bg-[#131C2E] border border-slate-800">
              <div className="font-medium text-sky-300">Ceramic & Armored Blocks</div>
              <p className="mt-1 text-xs text-slate-400">
                Ceramic shatters in 1 HP; Armored steel holds 2–3 HP. Upgrade Core Impact in the Workshop to break them in fewer hits.
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-[#131C2E] border border-slate-800">
              <div className="font-medium text-emerald-300">Crystal Vaults</div>
              <p className="mt-1 text-xs text-slate-400">
                High-value 3 HP prisms that drop multiple alloy shards and frequently release field pickups.
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-[#131C2E] border border-slate-800">
              <div className="font-medium text-red-300">TNT Explosive Charges</div>
              <p className="mt-1 text-xs text-slate-400">
                Detonate on contact to blast every breakable block within a 105px radius, triggering chain reactions.
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-[#131C2E] border border-slate-800">
              <div className="font-medium text-amber-300">Portals, Bumpers & Gravity Wells</div>
              <p className="mt-1 text-xs text-slate-400">
                Blue portals warp the ball into upper chambers; amber bumpers accelerate rebounds; gravity wells curve trajectories inward or outward.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
