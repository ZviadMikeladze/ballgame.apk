import { BrickDef, BrickKind, LevelConfig } from '../types/game';

export const ARENA_WIDTH = 760;
export const ARENA_HEIGHT = 560;
export const PADDLE_Y = 516;
export const PADDLE_HEIGHT = 14;
export const BALL_RADIUS = 8;

const GRID_START_X = 34;
const GRID_START_Y = 48;
const BRICK_W = 62;
const BRICK_H = 22;
const GAP_X = 8;
const GAP_Y = 8;

function makeBrick(
  id: string,
  col: number,
  row: number,
  kind: BrickKind,
  customHp?: number
): BrickDef {
  const defaults: Record<BrickKind, { hp: number; shard: number; score: number }> = {
    ceramic: { hp: 1, shard: 2, score: 100 },
    armored: { hp: 2, shard: 4, score: 220 },
    crystal: { hp: 3, shard: 8, score: 380 },
    explosive: { hp: 1, shard: 5, score: 260 },
    obsidian: { hp: 9999, shard: 0, score: 0 },
    core: { hp: 12, shard: 40, score: 1500 },
  };

  const d = defaults[kind];
  const hp = customHp ?? d.hp;

  return {
    id,
    x: GRID_START_X + col * (BRICK_W + GAP_X),
    y: GRID_START_Y + row * (BRICK_H + GAP_Y),
    w: BRICK_W,
    h: BRICK_H,
    kind,
    hp,
    maxHp: hp,
    shardValue: d.shard,
    scoreValue: d.score,
  };
}

function buildFromPattern(levelId: number, rows: string[]): BrickDef[] {
  const bricks: BrickDef[] = [];
  const legend: Record<string, { kind: BrickKind; hp?: number }> = {
    C: { kind: 'ceramic' },
    A: { kind: 'armored', hp: 2 },
    H: { kind: 'armored', hp: 3 },
    K: { kind: 'crystal', hp: 3 },
    E: { kind: 'explosive' },
    O: { kind: 'obsidian' },
  };

  rows.forEach((rowStr, rIdx) => {
    for (let cIdx = 0; cIdx < rowStr.length; cIdx++) {
      const ch = rowStr[cIdx];
      const spec = legend[ch];
      if (spec) {
        bricks.push(makeBrick(`L${levelId}-r${rIdx}-c${cIdx}`, cIdx, rIdx, spec.kind, spec.hp));
      }
    }
  });
  return bricks;
}

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: 'Foundry Gate',
    subtitle: 'Calibration Arena',
    mechanicSummary: 'Ceramic plates & first explosive charge',
    parTimeSeconds: 65,
    baseBallSpeed: 390,
    completionBonusShards: 20,
    bricks: buildFromPattern(1, [
      'CCCCCCCCCC',
      'CCAACCCAAC',
      'CCCECCCECC',
      'CCCCCCCCCC',
    ]),
    bumpers: [],
    portals: [],
    movingBars: [],
    gravityWells: [],
  },
  {
    id: 2,
    name: 'Twin Pillars',
    subtitle: 'Kinetic Bumpers',
    mechanicSummary: 'Armored steel blocks & high-rebound bumpers',
    parTimeSeconds: 75,
    baseBallSpeed: 410,
    completionBonusShards: 28,
    bricks: buildFromPattern(2, [
      'AA.KKKK.AA',
      'AC.CCCC.CA',
      'AE.CAAC.EA',
      'AC.CCCC.CA',
      'AA......AA',
    ]),
    bumpers: [
      { id: 'L2-b1', x: 260, y: 292, radius: 18, bounceBoost: 1.12 },
      { id: 'L2-b2', x: 500, y: 292, radius: 18, bounceBoost: 1.12 },
    ],
    portals: [],
    movingBars: [],
    gravityWells: [],
  },
  {
    id: 3,
    name: 'Pendulum Vault',
    subtitle: 'Moving Deflectors',
    mechanicSummary: 'Patrolling steel sliders & explosive chain reactions',
    parTimeSeconds: 85,
    baseBallSpeed: 425,
    completionBonusShards: 35,
    bricks: buildFromPattern(3, [
      'KK.AAAA.KK',
      'CC.CEEC.CC',
      'AA.CCCC.AA',
      'CC.EAAE.CC',
      'CCCCCCCCCC',
    ]),
    bumpers: [],
    portals: [],
    movingBars: [
      { id: 'L3-m1', x: 220, y: 278, w: 108, h: 12, minX: 60, maxX: 340, speed: 135, phase: 0 },
      { id: 'L3-m2', x: 440, y: 342, w: 108, h: 12, minX: 410, maxX: 690, speed: 155, phase: 1.6 },
    ],
    gravityWells: [],
  },
  {
    id: 4,
    name: 'Portal Chamber',
    subtitle: 'Phase Conduits',
    mechanicSummary: 'Paired warp portals bypassing obsidian shields',
    parTimeSeconds: 95,
    baseBallSpeed: 435,
    completionBonusShards: 45,
    bricks: buildFromPattern(4, [
      'KKKKKKKKKK',
      'AA.CEEC.AA',
      'CC.AAAA.CC',
      'OOOOOOOOOO',
      '.CC....CC.',
    ].map((row, idx) => (idx === 3 ? 'OO......OO' : row))),
    bumpers: [
      { id: 'L4-b1', x: 380, y: 268, radius: 16, bounceBoost: 1.1 },
    ],
    portals: [
      { id: 'L4-p1', ax: 120, ay: 325, bx: 205, by: 108, radius: 18 },
      { id: 'L4-p2', ax: 640, ay: 325, bx: 555, by: 108, radius: 18 },
    ],
    movingBars: [],
    gravityWells: [],
  },
  {
    id: 5,
    name: 'The Fortress',
    subtitle: 'Ricochet Chutes',
    mechanicSummary: 'Obsidian bunkers guarding high-value crystal vaults',
    parTimeSeconds: 105,
    baseBallSpeed: 450,
    completionBonusShards: 55,
    bricks: buildFromPattern(5, [
      '.KKKKKKKK.',
      '.AEEAAEEA.',
      '.OO.HH.OO.',
      'CC..CC..CC',
      'AA.CEEC.AA',
      'OO......OO',
    ]),
    bumpers: [
      { id: 'L5-b1', x: 185, y: 315, radius: 17, bounceBoost: 1.14 },
      { id: 'L5-b2', x: 575, y: 315, radius: 17, bounceBoost: 1.14 },
    ],
    portals: [],
    movingBars: [
      { id: 'L5-m1', x: 320, y: 356, w: 120, h: 12, minX: 210, maxX: 550, speed: 150, phase: 0.7 },
    ],
    gravityWells: [],
  },
  {
    id: 6,
    name: 'Reactor Grid',
    subtitle: 'Overload Lattice',
    mechanicSummary: 'Dense armored lattice with explosive blast nodes',
    parTimeSeconds: 115,
    baseBallSpeed: 465,
    completionBonusShards: 68,
    bricks: buildFromPattern(6, [
      'K.H.KK.H.K',
      'C.E.AA.E.C',
      'H.K.EE.K.H',
      'A.C.HH.C.A',
      'E.A.CC.A.E',
      'C.C....C.C',
    ]),
    bumpers: [
      { id: 'L6-b1', x: 380, y: 300, radius: 20, bounceBoost: 1.15 },
    ],
    portals: [
      { id: 'L6-p1', ax: 96, ay: 295, bx: 664, by: 145, radius: 17 },
    ],
    movingBars: [
      { id: 'L6-m1', x: 160, y: 365, w: 96, h: 12, minX: 50, maxX: 340, speed: 170, phase: 0 },
      { id: 'L6-m2', x: 500, y: 365, w: 96, h: 12, minX: 420, maxX: 710, speed: 170, phase: 2.1 },
    ],
    gravityWells: [],
  },
  {
    id: 7,
    name: 'Gravity Anomaly',
    subtitle: 'Curved Trajectories',
    mechanicSummary: 'Attraction & repulsion fields bending ball flight',
    parTimeSeconds: 120,
    baseBallSpeed: 475,
    completionBonusShards: 82,
    bricks: buildFromPattern(7, [
      'KKKKKKKKKK',
      'HH.CEEC.HH',
      'AA.KKKK.AA',
      'CC.EAAE.CC',
      'OO..HH..OO',
    ]),
    bumpers: [
      { id: 'L7-b1', x: 205, y: 330, radius: 16, bounceBoost: 1.12 },
      { id: 'L7-b2', x: 555, y: 330, radius: 16, bounceBoost: 1.12 },
    ],
    portals: [],
    movingBars: [],
    gravityWells: [
      { id: 'L7-g1', x: 260, y: 268, radius: 74, strength: 290 },
      { id: 'L7-g2', x: 500, y: 268, radius: 74, strength: -260 },
    ],
  },
  {
    id: 8,
    name: 'Omega Core',
    subtitle: 'Final Reactor',
    mechanicSummary: 'Shatter the central 16-HP Core and its shielded guard lattice',
    parTimeSeconds: 140,
    baseBallSpeed: 490,
    completionBonusShards: 120,
    bricks: [
      ...buildFromPattern(8, [
        'K.HH..HH.K',
        'A.E....E.A',
        'H........H',
        'A.E....E.A',
        'OO.AAAA.OO',
      ]),
      {
        id: 'L8-OMEGA-CORE',
        x: 316,
        y: 82,
        w: 128,
        h: 52,
        kind: 'core',
        hp: 16,
        maxHp: 16,
        shardValue: 65,
        scoreValue: 2500,
      },
    ],
    bumpers: [
      { id: 'L8-b1', x: 180, y: 270, radius: 18, bounceBoost: 1.14 },
      { id: 'L8-b2', x: 580, y: 270, radius: 18, bounceBoost: 1.14 },
    ],
    portals: [
      { id: 'L8-p1', ax: 104, ay: 345, bx: 278, by: 122, radius: 17 },
      { id: 'L8-p2', ax: 656, ay: 345, bx: 482, by: 122, radius: 17 },
    ],
    movingBars: [
      { id: 'L8-m1', x: 310, y: 330, w: 136, h: 12, minX: 190, maxX: 570, speed: 185, phase: 0.4 },
    ],
    gravityWells: [
      { id: 'L8-g1', x: 380, y: 245, radius: 78, strength: 240 },
    ],
  },
];

export function getLevelById(id: number): LevelConfig {
  return LEVELS.find((lvl) => lvl.id === id) ?? LEVELS[0];
}
