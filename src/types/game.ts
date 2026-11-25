export type AppView = 'TITLE' | 'PLAYING' | 'LEVELS' | 'UPGRADES' | 'GUIDE';

export type PlayOverlayState = 'NONE' | 'PAUSED' | 'LEVEL_COMPLETE' | 'GAME_OVER';

export type BrickKind =
  | 'ceramic'
  | 'armored'
  | 'crystal'
  | 'explosive'
  | 'obsidian'
  | 'core';

export interface BrickDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: BrickKind;
  hp: number;
  maxHp: number;
  shardValue: number;
  scoreValue: number;
}

export interface BumperDef {
  id: string;
  x: number;
  y: number;
  radius: number;
  bounceBoost: number;
}

export interface PortalDef {
  id: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  radius: number;
}

export interface MovingBarDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minX: number;
  maxX: number;
  speed: number;
  phase?: number;
}

export interface GravityWellDef {
  id: string;
  x: number;
  y: number;
  radius: number;
  strength: number; // positive attracts, negative repels
}

export interface LevelConfig {
  id: number;
  name: string;
  subtitle: string;
  mechanicSummary: string;
  parTimeSeconds: number;
  baseBallSpeed: number;
  completionBonusShards: number;
  bricks: BrickDef[];
  bumpers: BumperDef[];
  portals: PortalDef[];
  movingBars: MovingBarDef[];
  gravityWells: GravityWellDef[];
}

export type UpgradeId =
  | 'ball_power'
  | 'ball_speed'
  | 'paddle_width'
  | 'floor_shield'
  | 'shard_magnet'
  | 'multi_split';

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
  maxLevel: number;
  costs: number[];
  formatStat: (level: number) => string;
  formatNextDelta: (level: number) => string;
}

export type UpgradeLevels = Record<UpgradeId, number>;

export interface LevelProgress {
  unlocked: boolean;
  stars: number; // 0 to 3
  bestScore: number;
  bestTimeSeconds: number | null;
}

export interface SaveData {
  shards: number;
  totalBricksBroken: number;
  upgrades: UpgradeLevels;
  levels: Record<number, LevelProgress>;
  muted: boolean;
}

export type PowerUpType = 'MULTI_BALL' | 'WIDE_PADDLE' | 'POWER_SURGE' | 'SHIELD_RECHARGE';

export interface LiveHUDState {
  levelId: number;
  levelName: string;
  score: number;
  shardsEarned: number;
  lives: number;
  maxLives: number;
  shieldCharges: number;
  maxShieldCharges: number;
  bricksRemaining: number;
  totalBreakableBricks: number;
  elapsedSeconds: number;
  combo: number;
  activeBuffs: {
    widePaddleRemaining: number;
    powerSurgeRemaining: number;
  };
  awaitingLaunch: boolean;
}

export interface LevelResult {
  levelId: number;
  won: boolean;
  score: number;
  shardsEarned: number;
  completionBonus: number;
  elapsedSeconds: number;
  livesRemaining: number;
  starsEarned: number;
  bricksBroken: number;
}
