import { UpgradeDefinition, UpgradeId, UpgradeLevels } from '../types/game';

export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  {
    id: 'ball_power',
    name: 'Core Impact',
    description: 'Increases damage dealt per ball collision, shattering armored blocks and boss cores faster.',
    maxLevel: 5,
    costs: [0, 35, 75, 140, 230],
    formatStat: (lvl) => `${lvl} DMG / hit`,
    formatNextDelta: (lvl) => (lvl < 5 ? `+1 DMG` : 'Maxed'),
  },
  {
    id: 'paddle_width',
    name: 'Paddle Span',
    description: 'Extends the kinetic deflector bar width for wider defensive coverage and sharper bank angles.',
    maxLevel: 5,
    costs: [0, 30, 65, 120, 200],
    formatStat: (lvl) => `${96 + (lvl - 1) * 18}px wide`,
    formatNextDelta: (lvl) => (lvl < 5 ? `+18px width` : 'Maxed'),
  },
  {
    id: 'ball_speed',
    name: 'Kinetic Thrusters',
    description: 'Boosts ball launch velocity and paddle responsiveness for faster arena clears.',
    maxLevel: 5,
    costs: [0, 25, 55, 105, 180],
    formatStat: (lvl) => `${100 + (lvl - 1) * 10}% speed`,
    formatNextDelta: (lvl) => (lvl < 5 ? `+10% velocity` : 'Maxed'),
  },
  {
    id: 'floor_shield',
    name: 'Safety Barrier',
    description: 'Deploys emergency floor shield charges at the start of every level to bounce missed balls back into play.',
    maxLevel: 4,
    costs: [0, 45, 95, 175],
    formatStat: (lvl) => `${lvl - 1} charge${lvl - 1 === 1 ? '' : 's'} / level`,
    formatNextDelta: (lvl) => (lvl < 4 ? `+1 shield charge` : 'Maxed'),
  },
  {
    id: 'shard_magnet',
    name: 'Shard Magnet',
    description: 'Generates an attraction field around the paddle that pulls falling alloy shards toward you.',
    maxLevel: 4,
    costs: [0, 30, 70, 130],
    formatStat: (lvl) => (lvl === 1 ? 'Manual catch' : `${(lvl - 1) * 85}px pull`),
    formatNextDelta: (lvl) => (lvl < 4 ? `+85px pull range` : 'Maxed'),
  },
  {
    id: 'multi_split',
    name: 'Twin Split Chance',
    description: 'Gives critical paddle returns a chance to spawn an extra kinetic ball on launch or bumper impact.',
    maxLevel: 4,
    costs: [0, 60, 125, 220],
    formatStat: (lvl) => (lvl === 1 ? '0% passive' : `${(lvl - 1) * 10}% split`),
    formatNextDelta: (lvl) => (lvl < 4 ? `+10% split chance` : 'Maxed'),
  },
];

export const DEFAULT_UPGRADES: UpgradeLevels = {
  ball_power: 1,
  ball_speed: 1,
  paddle_width: 1,
  floor_shield: 1,
  shard_magnet: 1,
  multi_split: 1,
};

export function getUpgradeCost(id: UpgradeId, currentLevel: number): number | null {
  const def = UPGRADE_DEFINITIONS.find((u) => u.id === id);
  if (!def || currentLevel >= def.maxLevel) return null;
  return def.costs[currentLevel];
}

export function getComputedStats(upgrades: UpgradeLevels) {
  return {
    damage: upgrades.ball_power,
    paddleWidth: 96 + (upgrades.paddle_width - 1) * 18,
    speedMultiplier: 1 + (upgrades.ball_speed - 1) * 0.1,
    startingShields: upgrades.floor_shield - 1,
    magnetRange: (upgrades.shard_magnet - 1) * 85,
    splitChance: (upgrades.multi_split - 1) * 0.1,
  };
}
