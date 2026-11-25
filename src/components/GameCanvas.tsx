import React, { useEffect, useRef } from 'react';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BALL_RADIUS,
  PADDLE_HEIGHT,
  PADDLE_Y,
} from '../data/levels';
import { getComputedStats } from '../data/upgrades';
import {
  BrickDef,
  LevelConfig,
  LevelResult,
  LiveHUDState,
  PlayOverlayState,
  PowerUpType,
  UpgradeLevels,
} from '../types/game';
import { sound } from '../utils/sound';
import { ParticleSystem } from '../utils/particles';

interface GameCanvasProps {
  level: LevelConfig;
  upgrades: UpgradeLevels;
  overlayState: PlayOverlayState;
  runKey: number;
  onHudUpdate: (hud: LiveHUDState) => void;
  onLevelEnd: (result: LevelResult) => void;
  onTogglePause: () => void;
}

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  trail: Array<{ x: number; y: number }>;
  portalCooldown: number;
  stuckToPaddle: boolean;
  aimAngle: number;
}

interface ActiveBrick extends BrickDef {
  hitFlash: number;
}

interface ActiveMovingBar {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minX: number;
  maxX: number;
  speed: number;
  dir: number;
}

interface FallingItem {
  id: number;
  x: number;
  y: number;
  vy: number;
  kind: 'shard' | 'powerup';
  shardAmount?: number;
  powerUpType?: PowerUpType;
}

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  level,
  upgrades,
  overlayState,
  runKey,
  onHudUpdate,
  onLevelEnd,
  onTogglePause,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<PlayOverlayState>(overlayState);
  overlayRef.current = overlayState;

  const callbacksRef = useRef({ onHudUpdate, onLevelEnd, onTogglePause });
  callbacksRef.current = { onHudUpdate, onLevelEnd, onTogglePause };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = ARENA_WIDTH * dpr;
    canvas.height = ARENA_HEIGHT * dpr;

    const stats = getComputedStats(upgrades);
    const baseSpeed = level.baseBallSpeed * stats.speedMultiplier;

    let nextEntityId = 1;
    let paddleX = ARENA_WIDTH / 2;
    let prevPaddleX = paddleX;
    let paddleVx = 0;

    let lives = 3;
    const maxLives = 3;
    let shieldCharges = stats.startingShields;
    const maxShieldCharges = Math.max(stats.startingShields, 3);
    let score = 0;
    let shardsEarned = 0;
    let bricksBroken = 0;
    let combo = 0;
    let elapsedSeconds = 0;
    let levelFinished = false;

    let widePaddleRemaining = 0;
    let powerSurgeRemaining = 0;
    let screenShake = 0;
    let shieldFlash = 0;
    let aimPhase = 0;

    const bricks: ActiveBrick[] = level.bricks.map((b) => ({
      ...b,
      hitFlash: 0,
    }));

    const totalBreakableBricks = bricks.filter((b) => b.kind !== 'obsidian').length;

    const movingBars: ActiveMovingBar[] = level.movingBars.map((m) => ({
      id: m.id,
      x: m.x,
      y: m.y,
      w: m.w,
      h: m.h,
      minX: m.minX,
      maxX: m.maxX,
      speed: m.speed,
      dir: Math.cos(m.phase ?? 0) >= 0 ? 1 : -1,
    }));

    const bumperFlashes: Record<string, number> = {};
    const portalFlashes: Record<string, number> = {};

    const createStuckBall = (): Ball => ({
      id: nextEntityId++,
      x: paddleX,
      y: PADDLE_Y - BALL_RADIUS - 1,
      vx: 0,
      vy: 0,
      radius: BALL_RADIUS,
      trail: [],
      portalCooldown: 0,
      stuckToPaddle: true,
      aimAngle: -Math.PI / 2 + 0.18,
    });

    const balls: Ball[] = [createStuckBall()];
    const items: FallingItem[] = [];
    const particleSystem = new ParticleSystem();
    const floatingTexts: FloatingText[] = [];

    const keys = { left: false, right: false };

    const getCurrentPaddleWidth = () =>
      stats.paddleWidth + (widePaddleRemaining > 0 ? 44 : 0);

    const getCurrentDamage = () =>
      stats.damage + (powerSurgeRemaining > 0 ? 2 : 0);

    const addFloatingText = (x: number, y: number, text: string, color: string) => {
      floatingTexts.push({
        x,
        y,
        vy: -38,
        text,
        color,
        life: 0.75,
        maxLife: 0.75,
      });
    };

    const spawnBrickDrop = (brick: ActiveBrick) => {
      if (brick.shardValue > 0) {
        const shardCount = brick.kind === 'core' ? 6 : brick.kind === 'crystal' ? 2 : 1;
        const perShard = Math.max(1, Math.round(brick.shardValue / shardCount));
        for (let i = 0; i < shardCount; i++) {
          items.push({
            id: nextEntityId++,
            x: brick.x + brick.w / 2 + (i - (shardCount - 1) / 2) * 14,
            y: brick.y + brick.h / 2,
            vy: 115 + Math.random() * 25,
            kind: 'shard',
            shardAmount: perShard,
          });
        }
      }

      const dropChance = brick.kind === 'crystal' ? 0.36 : 0.14;
      if (Math.random() < dropChance) {
        const roll = Math.random();
        let powerUpType: PowerUpType = 'WIDE_PADDLE';
        if (roll < 0.32) powerUpType = 'MULTI_BALL';
        else if (roll < 0.62) powerUpType = 'WIDE_PADDLE';
        else if (roll < 0.86) powerUpType = 'POWER_SURGE';
        else powerUpType = 'SHIELD_RECHARGE';

        items.push({
          id: nextEntityId++,
          x: brick.x + brick.w / 2,
          y: brick.y + brick.h / 2,
          vy: 128,
          kind: 'powerup',
          powerUpType,
        });
      }
    };

    const damageBrick = (
      brick: ActiveBrick,
      dmg: number,
      fromExplosion = false,
      hitNx = 0,
      hitNy = 0
    ) => {
      if (brick.kind === 'obsidian' || brick.hp <= 0) {
        if (brick.kind === 'obsidian' && !fromExplosion) {
          sound.armorClang();
          brick.hitFlash = 0.16;
          particleSystem.emitBrickHit(
            brick.x + brick.w / 2,
            brick.y + brick.h / 2,
            'obsidian',
            hitNx,
            hitNy
          );
        }
        return;
      }

      brick.hp -= dmg;
      brick.hitFlash = 0.2;

      if (brick.hp <= 0) {
        bricksBroken += 1;
        combo += 1;
        const comboBonus = Math.min(combo - 1, 10) * 15;
        score += brick.scoreValue + comboBonus;
        spawnBrickDrop(brick);

        particleSystem.emitBrickShatter(
          brick.x,
          brick.y,
          brick.w,
          brick.h,
          brick.kind
        );

        if (brick.kind === 'explosive') {
          sound.explosion();
          if (!particleSystem.isReducedMotion()) {
            screenShake = 0.25;
          }
          const cx = brick.x + brick.w / 2;
          const cy = brick.y + brick.h / 2;
          particleSystem.emitExplosion(cx, cy);
          // Damage nearby bricks
          for (const other of bricks) {
            if (other.id === brick.id || other.hp <= 0 || other.kind === 'obsidian') continue;
            const ox = other.x + other.w / 2;
            const oy = other.y + other.h / 2;
            const dist = Math.hypot(ox - cx, oy - cy);
            if (dist <= 105) {
              damageBrick(other, Math.max(2, getCurrentDamage()), true);
            }
          }
        } else {
          sound.brickBreak(combo);
        }
      } else {
        sound.brickHit(combo);
        particleSystem.emitBrickHit(
          brick.x + brick.w / 2,
          brick.y + brick.h / 2,
          brick.kind,
          hitNx,
          hitNy
        );
      }
    };

    const launchStuckBalls = () => {
      let launchedAny = false;
      for (const b of balls) {
        if (b.stuckToPaddle) {
          b.stuckToPaddle = false;
          b.vx = Math.cos(b.aimAngle) * baseSpeed;
          b.vy = Math.sin(b.aimAngle) * baseSpeed;
          launchedAny = true;

          // Upgrade: Twin Split Chance on launch
          if (stats.splitChance > 0 && balls.length < 5 && Math.random() < stats.splitChance) {
            const splitAngle = b.aimAngle + (Math.random() > 0.5 ? 0.28 : -0.28);
            balls.push({
              id: nextEntityId++,
              x: b.x,
              y: b.y,
              vx: Math.cos(splitAngle) * baseSpeed,
              vy: Math.sin(splitAngle) * baseSpeed,
              radius: BALL_RADIUS,
              trail: [],
              portalCooldown: 0,
              stuckToPaddle: false,
              aimAngle: splitAngle,
            });
            addFloatingText(b.x, b.y - 18, 'TWIN SPLIT', '#F59E0B');
          }
        }
      }
      if (launchedAny) {
        sound.paddleHit();
      }
    };

    const updatePaddleFromClientX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      const scaleX = ARENA_WIDTH / rect.width;
      const targetX = (clientX - rect.left) * scaleX;
      const halfW = getCurrentPaddleWidth() / 2;
      paddleX = Math.max(halfW + 8, Math.min(ARENA_WIDTH - halfW - 8, targetX));
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (overlayRef.current !== 'NONE') return;
      updatePaddleFromClientX(e.clientX);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (overlayRef.current !== 'NONE') return;
      updatePaddleFromClientX(e.clientX);
      launchStuckBalls();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keys.left = true;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keys.right = true;
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (overlayRef.current === 'NONE') {
          e.preventDefault();
          launchStuckBalls();
        }
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (overlayRef.current === 'NONE' || overlayRef.current === 'PAUSED') {
          callbacksRef.current.onTogglePause();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keys.left = false;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keys.right = false;
      }
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const resolveCircleRect = (
      ball: Ball,
      rx: number,
      ry: number,
      rw: number,
      rh: number
    ): { hit: boolean; nx: number; ny: number } => {
      const closestX = Math.max(rx, Math.min(ball.x, rx + rw));
      const closestY = Math.max(ry, Math.min(ball.y, ry + rh));
      const dx = ball.x - closestX;
      const dy = ball.y - closestY;
      const distSq = dx * dx + dy * dy;

      if (distSq > ball.radius * ball.radius) {
        return { hit: false, nx: 0, ny: 0 };
      }

      // Determine reflection normal cleanly
      const overlapLeft = ball.x + ball.radius - rx;
      const overlapRight = rx + rw - (ball.x - ball.radius);
      const overlapTop = ball.y + ball.radius - ry;
      const overlapBottom = ry + rh - (ball.y - ball.radius);

      const minOverlapX = Math.min(overlapLeft, overlapRight);
      const minOverlapY = Math.min(overlapTop, overlapBottom);

      if (minOverlapX < minOverlapY) {
        const nx = overlapLeft < overlapRight ? -1 : 1;
        ball.x += nx * minOverlapX;
        return { hit: true, nx, ny: 0 };
      } else {
        const ny = overlapTop < overlapBottom ? -1 : 1;
        ball.y += ny * minOverlapY;
        return { hit: true, nx: 0, ny };
      }
    };

    const computeStars = (won: boolean, timeSec: number, livesLeft: number): number => {
      if (!won) return 0;
      let stars = 1;
      if (livesLeft >= 2) stars += 1;
      if (timeSec <= level.parTimeSeconds) stars += 1;
      return Math.min(3, stars);
    };

    const stepPhysics = (dt: number) => {
      if (levelFinished) return;

      elapsedSeconds += dt;
      aimPhase += dt * 2.2;

      if (widePaddleRemaining > 0) widePaddleRemaining = Math.max(0, widePaddleRemaining - dt);
      if (powerSurgeRemaining > 0) powerSurgeRemaining = Math.max(0, powerSurgeRemaining - dt);
      if (screenShake > 0) screenShake = Math.max(0, screenShake - dt);
      if (shieldFlash > 0) shieldFlash = Math.max(0, shieldFlash - dt);

      // Keyboard paddle movement
      const paddleWidth = getCurrentPaddleWidth();
      const halfW = paddleWidth / 2;
      const keySpeed = 580 * Math.max(1, stats.speedMultiplier * 0.9);
      if (keys.left) paddleX -= keySpeed * dt;
      if (keys.right) paddleX += keySpeed * dt;
      paddleX = Math.max(halfW + 8, Math.min(ARENA_WIDTH - halfW - 8, paddleX));
      paddleVx = dt > 0 ? (paddleX - prevPaddleX) / dt : 0;
      prevPaddleX = paddleX;

      // Update moving bars
      for (const bar of movingBars) {
        bar.x += bar.dir * bar.speed * dt;
        if (bar.x <= bar.minX) {
          bar.x = bar.minX;
          bar.dir = 1;
        } else if (bar.x + bar.w >= bar.maxX) {
          bar.x = bar.maxX - bar.w;
          bar.dir = -1;
        }
      }

      // Decay flashes
      for (const b of bricks) {
        if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt);
      }
      for (const key of Object.keys(bumperFlashes)) {
        if (bumperFlashes[key] > 0) bumperFlashes[key] = Math.max(0, bumperFlashes[key] - dt);
      }
      for (const key of Object.keys(portalFlashes)) {
        if (portalFlashes[key] > 0) portalFlashes[key] = Math.max(0, portalFlashes[key] - dt);
      }

      // Sub-step balls
      const SUBSTEPS = 3;
      const subDt = dt / SUBSTEPS;

      for (let s = 0; s < SUBSTEPS; s++) {
        for (let bi = balls.length - 1; bi >= 0; bi--) {
          const ball = balls[bi];
          if (ball.stuckToPaddle) {
            ball.x = paddleX;
            ball.y = PADDLE_Y - ball.radius - 1;
            ball.aimAngle = -Math.PI / 2 + Math.sin(aimPhase) * 0.42;
            continue;
          }

          if (ball.portalCooldown > 0) {
            ball.portalCooldown = Math.max(0, ball.portalCooldown - subDt);
          }

          // Gravity wells
          for (const gw of level.gravityWells) {
            const dx = gw.x - ball.x;
            const dy = gw.y - ball.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 10 && dist < gw.radius) {
              const falloff = 1 - dist / gw.radius;
              const accel = gw.strength * falloff * 1.45;
              ball.vx += (dx / dist) * accel * subDt;
              ball.vy += (dy / dist) * accel * subDt;

              // Renormalize speed to avoid runaway acceleration
              const spd = Math.hypot(ball.vx, ball.vy);
              const maxAllowed = baseSpeed * 1.32;
              const minAllowed = baseSpeed * 0.85;
              if (spd > maxAllowed) {
                ball.vx = (ball.vx / spd) * maxAllowed;
                ball.vy = (ball.vy / spd) * maxAllowed;
              } else if (spd < minAllowed && spd > 0) {
                ball.vx = (ball.vx / spd) * minAllowed;
                ball.vy = (ball.vy / spd) * minAllowed;
              }
            }
          }

          ball.x += ball.vx * subDt;
          ball.y += ball.vy * subDt;

          // Arena wall collisions
          if (ball.x - ball.radius <= 8) {
            ball.x = 8 + ball.radius;
            ball.vx = Math.abs(ball.vx);
            sound.wallHit();
          } else if (ball.x + ball.radius >= ARENA_WIDTH - 8) {
            ball.x = ARENA_WIDTH - 8 - ball.radius;
            ball.vx = -Math.abs(ball.vx);
            sound.wallHit();
          }

          if (ball.y - ball.radius <= 8) {
            ball.y = 8 + ball.radius;
            ball.vy = Math.abs(ball.vy);
            sound.wallHit();
          }

          // Paddle collision
          if (
            ball.vy > 0 &&
            ball.y + ball.radius >= PADDLE_Y &&
            ball.y - ball.radius <= PADDLE_Y + PADDLE_HEIGHT &&
            ball.x + ball.radius >= paddleX - halfW &&
            ball.x - ball.radius <= paddleX + halfW
          ) {
            const hitOffset = Math.max(-1, Math.min(1, (ball.x - paddleX) / halfW));
            const bounceAngle = -Math.PI / 2 + hitOffset * (Math.PI * 0.36);
            const currentSpeed = Math.max(baseSpeed, Math.hypot(ball.vx, ball.vy));
            ball.vx = Math.cos(bounceAngle) * currentSpeed + paddleVx * 0.1;
            ball.vy = -Math.abs(Math.sin(bounceAngle) * currentSpeed);

            // Re-normalize to target speed
            const norm = Math.hypot(ball.vx, ball.vy);
            if (norm > 0) {
              ball.vx = (ball.vx / norm) * currentSpeed;
              ball.vy = (ball.vy / norm) * currentSpeed;
            }
            ball.y = PADDLE_Y - ball.radius - 0.5;
            combo = 0;
            sound.paddleHit();
            particleSystem.emitSparks(ball.x, PADDLE_Y, '#F59E0B', 5, 130);
          }

          // Moving bars collision
          for (const bar of movingBars) {
            const res = resolveCircleRect(ball, bar.x, bar.y, bar.w, bar.h);
            if (res.hit) {
              if (res.nx !== 0) ball.vx = Math.abs(ball.vx) * res.nx;
              if (res.ny !== 0) ball.vy = Math.abs(ball.vy) * res.ny;
              sound.armorClang();
              particleSystem.emitSparks(ball.x, ball.y, '#CBD5E1', 4, 110);
            }
          }

          // Bumpers collision
          for (const bumper of level.bumpers) {
            const dx = ball.x - bumper.x;
            const dy = ball.y - bumper.y;
            const dist = Math.hypot(dx, dy);
            const minDist = ball.radius + bumper.radius;
            if (dist < minDist && dist > 0.001) {
              const nx = dx / dist;
              const ny = dy / dist;
              ball.x = bumper.x + nx * (minDist + 1);
              ball.y = bumper.y + ny * (minDist + 1);

              const dot = ball.vx * nx + ball.vy * ny;
              ball.vx = ball.vx - 2 * dot * nx;
              ball.vy = ball.vy - 2 * dot * ny;

              const spd = Math.hypot(ball.vx, ball.vy);
              const targetSpd = Math.min(baseSpeed * 1.24, Math.max(baseSpeed, spd * bumper.bounceBoost));
              if (spd > 0) {
                ball.vx = (ball.vx / spd) * targetSpd;
                ball.vy = (ball.vy / spd) * targetSpd;
              }
              bumperFlashes[bumper.id] = 0.22;
              score += 50;
              sound.bumperPing();
              particleSystem.emitSparks(ball.x, ball.y, '#F59E0B', 7, 175);
              particleSystem.emitRing(bumper.x, bumper.y, bumper.radius + 18, '#F59E0B', 0.22, 2);

              if (stats.splitChance > 0 && balls.length < 5 && Math.random() < stats.splitChance * 0.65) {
                balls.push({
                  id: nextEntityId++,
                  x: ball.x,
                  y: ball.y,
                  vx: -ball.vx,
                  vy: ball.vy,
                  radius: BALL_RADIUS,
                  trail: [],
                  portalCooldown: 0.3,
                  stuckToPaddle: false,
                  aimAngle: 0,
                });
                addFloatingText(bumper.x, bumper.y - 24, 'SPLIT', '#F59E0B');
              }
            }
          }

          // Portals
          if (ball.portalCooldown <= 0) {
            for (const portal of level.portals) {
              const distA = Math.hypot(ball.x - portal.ax, ball.y - portal.ay);
              const distB = Math.hypot(ball.x - portal.bx, ball.y - portal.by);
              if (distA < portal.radius + ball.radius * 0.5) {
                ball.x = portal.bx;
                ball.y = portal.by;
                ball.portalCooldown = 0.45;
                portalFlashes[portal.id] = 0.3;
                sound.portalWarp();
                particleSystem.emitSparks(portal.ax, portal.ay, '#38BDF8', 7, 140);
                particleSystem.emitSparks(portal.bx, portal.by, '#38BDF8', 7, 140);
                break;
              } else if (distB < portal.radius + ball.radius * 0.5) {
                ball.x = portal.ax;
                ball.y = portal.ay;
                ball.portalCooldown = 0.45;
                portalFlashes[portal.id] = 0.3;
                sound.portalWarp();
                particleSystem.emitSparks(portal.bx, portal.by, '#38BDF8', 7, 140);
                particleSystem.emitSparks(portal.ax, portal.ay, '#38BDF8', 7, 140);
                break;
              }
            }
          }

          // Brick collisions (one brick per substep max per ball for clean reflection)
          for (const brick of bricks) {
            if (brick.hp <= 0) continue;
            const res = resolveCircleRect(ball, brick.x, brick.y, brick.w, brick.h);
            if (res.hit) {
              if (res.nx !== 0) ball.vx = Math.abs(ball.vx) * res.nx;
              if (res.ny !== 0) ball.vy = Math.abs(ball.vy) * res.ny;
              damageBrick(brick, getCurrentDamage(), false, res.nx, res.ny);
              break;
            }
          }

          // Anti-horizontal-stall safeguard
          const curSpd = Math.hypot(ball.vx, ball.vy);
          if (curSpd > 0 && Math.abs(ball.vy) < curSpd * 0.2) {
            const signY = ball.vy >= 0 ? 1 : -1;
            ball.vy = signY * curSpd * 0.24;
            const signX = ball.vx >= 0 ? 1 : -1;
            ball.vx = signX * Math.sqrt(Math.max(1, curSpd * curSpd - ball.vy * ball.vy));
          }

          // Floor shield or bottom boundary
          if (ball.y + ball.radius >= ARENA_HEIGHT - 8) {
            if (shieldCharges > 0) {
              shieldCharges -= 1;
              shieldFlash = 0.35;
              ball.y = ARENA_HEIGHT - 16 - ball.radius;
              ball.vy = -Math.abs(ball.vy);
              sound.shieldDeflect();
              addFloatingText(ball.x, ARENA_HEIGHT - 32, 'SHIELD SAVE', '#10B981');
              particleSystem.emitRing(ball.x, ARENA_HEIGHT - 14, 42, '#10B981', 0.28, 2.5);
              particleSystem.emitSparks(ball.x, ARENA_HEIGHT - 14, '#10B981', 10, 185);
            } else {
              balls.splice(bi, 1);
            }
          }
        }
      }

      // Record ball trails
      for (const ball of balls) {
        if (!ball.stuckToPaddle) {
          ball.trail.push({ x: ball.x, y: ball.y });
          if (ball.trail.length > 9) ball.trail.shift();
        }
      }

      // Check lost all balls
      if (balls.length === 0) {
        lives -= 1;
        combo = 0;
        sound.ballLost();
        if (lives <= 0) {
          levelFinished = true;
          callbacksRef.current.onLevelEnd({
            levelId: level.id,
            won: false,
            score,
            shardsEarned,
            completionBonus: 0,
            elapsedSeconds: Math.round(elapsedSeconds),
            livesRemaining: 0,
            starsEarned: 0,
            bricksBroken,
          });
          return;
        } else {
          balls.push(createStuckBall());
        }
      }

      // Update falling items (shards & powerups)
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.y += item.vy * dt;

        // Shard magnet pull
        if (item.kind === 'shard' && stats.magnetRange > 0) {
          const dx = paddleX - item.x;
          const dy = PADDLE_Y - item.y;
          const dist = Math.hypot(dx, dy);
          if (dist < stats.magnetRange && dist > 1) {
            const pullSpeed = 340 * (1 - dist / (stats.magnetRange + 40));
            item.x += (dx / dist) * pullSpeed * dt;
            item.y += (dy / dist) * pullSpeed * dt;
          }
        }

        // Paddle pickup check
        if (
          item.y + 10 >= PADDLE_Y &&
          item.y - 10 <= PADDLE_Y + PADDLE_HEIGHT + 4 &&
          item.x >= paddleX - halfW - 10 &&
          item.x <= paddleX + halfW + 10
        ) {
          if (item.kind === 'shard') {
            const amt = item.shardAmount ?? 2;
            shardsEarned += amt;
            score += amt * 10;
            sound.shardCollect();
            particleSystem.emitShardCollect(item.x, PADDLE_Y);
            addFloatingText(item.x, PADDLE_Y - 12, `+${amt} SHARD`, '#F59E0B');
          } else if (item.powerUpType) {
            sound.powerUp();
            if (item.powerUpType === 'MULTI_BALL') {
              const source = balls[0];
              if (source && balls.length < 5) {
                for (const offset of [-0.32, 0.32]) {
                  if (balls.length >= 5) break;
                  const baseAng = source.stuckToPaddle
                    ? -Math.PI / 2
                    : Math.atan2(source.vy, source.vx);
                  const ang = baseAng + offset;
                  balls.push({
                    id: nextEntityId++,
                    x: source.x,
                    y: source.y,
                    vx: Math.cos(ang) * baseSpeed,
                    vy: Math.sin(ang) * baseSpeed,
                    radius: BALL_RADIUS,
                    trail: [],
                    portalCooldown: 0,
                    stuckToPaddle: false,
                    aimAngle: ang,
                  });
                }
              }
              particleSystem.emitPowerUpCollect(item.x, PADDLE_Y, '#38BDF8');
              addFloatingText(paddleX, PADDLE_Y - 18, 'MULTI-BALL', '#38BDF8');
            } else if (item.powerUpType === 'WIDE_PADDLE') {
              widePaddleRemaining = 12;
              particleSystem.emitPowerUpCollect(item.x, PADDLE_Y, '#10B981');
              addFloatingText(paddleX, PADDLE_Y - 18, 'WIDE PADDLE', '#10B981');
            } else if (item.powerUpType === 'POWER_SURGE') {
              powerSurgeRemaining = 10;
              particleSystem.emitPowerUpCollect(item.x, PADDLE_Y, '#EF4444');
              addFloatingText(paddleX, PADDLE_Y - 18, '+2 IMPACT', '#EF4444');
            } else if (item.powerUpType === 'SHIELD_RECHARGE') {
              shieldCharges = Math.min(maxShieldCharges, shieldCharges + 1);
              particleSystem.emitPowerUpCollect(item.x, PADDLE_Y, '#2DD4BF');
              addFloatingText(paddleX, PADDLE_Y - 18, '+1 SHIELD', '#10B981');
            }
          }
          items.splice(i, 1);
          continue;
        }

        if (item.y > ARENA_HEIGHT + 20) {
          items.splice(i, 1);
        }
      }

      // Particles & shockwave rings
      particleSystem.step(dt);

      // Floating texts
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy * dt;
        ft.life -= dt;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
      }

      // Check victory condition
      const remainingBreakable = bricks.filter((b) => b.kind !== 'obsidian' && b.hp > 0).length;
      if (remainingBreakable === 0) {
        levelFinished = true;
        // Collect any remaining falling shards automatically on win
        for (const item of items) {
          if (item.kind === 'shard') {
            shardsEarned += item.shardAmount ?? 2;
          }
        }
        sound.levelClear();
        particleSystem.emitVictoryBurst(ARENA_WIDTH, ARENA_HEIGHT);
        const roundedTime = Math.round(elapsedSeconds);
        const starsEarned = computeStars(true, roundedTime, lives);
        callbacksRef.current.onLevelEnd({
          levelId: level.id,
          won: true,
          score: score + lives * 250,
          shardsEarned,
          completionBonus: level.completionBonusShards,
          elapsedSeconds: roundedTime,
          livesRemaining: lives,
          starsEarned,
          bricksBroken,
        });
      }
    };

    const drawArena = () => {
      ctx.save();
      ctx.scale(dpr, dpr);

      // Subtle screen shake
      if (screenShake > 0) {
        const mag = screenShake * 18;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }

      // Arena surface
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

      // Subtle architectural grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
      ctx.lineWidth = 1;
      for (let gx = 40; gx < ARENA_WIDTH; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 8);
        ctx.lineTo(gx, ARENA_HEIGHT - 8);
        ctx.stroke();
      }
      for (let gy = 40; gy < ARENA_HEIGHT; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(8, gy);
        ctx.lineTo(ARENA_WIDTH - 8, gy);
        ctx.stroke();
      }

      // Arena perimeter frame
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, ARENA_WIDTH - 16, ARENA_HEIGHT - 16);

      // Gravity wells (drawn underneath everything)
      for (const gw of level.gravityWells) {
        const isAttract = gw.strength > 0;
        const grad = ctx.createRadialGradient(gw.x, gw.y, 4, gw.x, gw.y, gw.radius);
        if (isAttract) {
          grad.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
          grad.addColorStop(0.6, 'rgba(245, 158, 11, 0.06)');
          grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        } else {
          grad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
          grad.addColorStop(0.6, 'rgba(56, 189, 248, 0.06)');
          grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(gw.x, gw.y, gw.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isAttract ? 'rgba(245, 158, 11, 0.35)' : 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(gw.x, gw.y, gw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = isAttract ? '#F59E0B' : '#38BDF8';
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isAttract ? 'PULL' : 'REPEL', gw.x, gw.y + 3);
      }

      // Portals
      for (const portal of level.portals) {
        const flash = portalFlashes[portal.id] ?? 0;
        const drawGate = (px: number, py: number, label: string) => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, portal.radius + flash * 8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(14, 165, 233, 0.14)';
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = flash > 0 ? '#BAE6FD' : '#38BDF8';
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(px, py, portal.radius * 0.52, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(186, 230, 253, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#E0F2FE';
          ctx.font = '700 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(label, px, py + 3);
          ctx.restore();
        };
        drawGate(portal.ax, portal.ay, 'IN');
        drawGate(portal.bx, portal.by, 'OUT');
      }

      // Moving deflectors + rail tracks
      for (const bar of movingBars) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bar.minX, bar.y + bar.h / 2);
        ctx.lineTo(bar.maxX, bar.y + bar.h / 2);
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.roundRect(bar.x, bar.y, bar.w, bar.h, 4);
        ctx.fill();
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Bumpers
      for (const bumper of level.bumpers) {
        const flash = bumperFlashes[bumper.id] ?? 0;
        const r = bumper.radius + flash * 10;
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, r, 0, Math.PI * 2);
        ctx.fillStyle = flash > 0 ? '#F59E0B' : '#1E293B';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#F59E0B';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = flash > 0 ? '#FEF3C7' : '#F59E0B';
        ctx.fill();
      }

      // Bricks
      for (const brick of bricks) {
        if (brick.hp <= 0) continue;

        let fill = '#0284C7';
        let stroke = '#38BDF8';
        if (brick.kind === 'armored') {
          fill = '#334155';
          stroke = '#94A3B8';
        } else if (brick.kind === 'crystal') {
          fill = '#065F46';
          stroke = '#10B981';
        } else if (brick.kind === 'explosive') {
          fill = '#991B1B';
          stroke = '#EF4444';
        } else if (brick.kind === 'obsidian') {
          fill = '#111827';
          stroke = '#475569';
        } else if (brick.kind === 'core') {
          fill = '#78350F';
          stroke = '#F59E0B';
        }

        if (brick.hitFlash > 0) {
          fill = '#F8FAFC';
        }

        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 4);
        ctx.fill();

        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Surface highlights & HP markings
        if (brick.kind === 'explosive') {
          ctx.fillStyle = '#FECACA';
          ctx.font = '700 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('TNT', brick.x + brick.w / 2, brick.y + brick.h / 2 + 3.5);
        } else if (brick.kind === 'obsidian') {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          ctx.beginPath();
          ctx.moveTo(brick.x + 6, brick.y + 6);
          ctx.lineTo(brick.x + brick.w - 6, brick.y + brick.h - 6);
          ctx.moveTo(brick.x + brick.w - 6, brick.y + 6);
          ctx.lineTo(brick.x + 6, brick.y + brick.h - 6);
          ctx.stroke();
        } else if (brick.kind === 'core') {
          const pct = Math.max(0, brick.hp / brick.maxHp);
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(brick.x + 12, brick.y + brick.h - 12, brick.w - 24, 5);
          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(brick.x + 12, brick.y + brick.h - 12, (brick.w - 24) * pct, 5);

          ctx.fillStyle = '#FEF3C7';
          ctx.font = '700 13px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`CORE ${brick.hp}`, brick.x + brick.w / 2, brick.y + 24);
        } else if (brick.hp > 1) {
          ctx.fillStyle = '#E2E8F0';
          ctx.font = '700 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${brick.hp}`, brick.x + brick.w / 2, brick.y + brick.h / 2 + 3.5);
        }
      }

      // Floor shield line
      if (shieldCharges > 0 || shieldFlash > 0) {
        ctx.strokeStyle =
          shieldFlash > 0 ? '#6EE7B7' : 'rgba(16, 185, 129, 0.72)';
        ctx.lineWidth = shieldFlash > 0 ? 4 : 2.5;
        ctx.beginPath();
        ctx.moveTo(12, ARENA_HEIGHT - 12);
        ctx.lineTo(ARENA_WIDTH - 12, ARENA_HEIGHT - 12);
        ctx.stroke();
      }

      // Falling items
      for (const item of items) {
        if (item.kind === 'shard') {
          ctx.save();
          ctx.translate(item.x, item.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(-5, -5, 10, 10);
          ctx.strokeStyle = '#FEF3C7';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(-5, -5, 10, 10);
          ctx.restore();
        } else if (item.powerUpType) {
          const badgeColors: Record<PowerUpType, { bg: string; label: string }> = {
            MULTI_BALL: { bg: '#0284C7', label: 'MULTI' },
            WIDE_PADDLE: { bg: '#059669', label: 'WIDE' },
            POWER_SURGE: { bg: '#DC2626', label: 'SURGE' },
            SHIELD_RECHARGE: { bg: '#0D9488', label: 'SHIELD' },
          };
          const spec = badgeColors[item.powerUpType];
          ctx.fillStyle = spec.bg;
          ctx.beginPath();
          ctx.roundRect(item.x - 24, item.y - 9, 48, 18, 4);
          ctx.fill();
          ctx.strokeStyle = '#F8FAFC';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '700 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(spec.label, item.x, item.y + 3);
        }
      }

      // Particles, debris chips, sparkle bursts & chime rings
      particleSystem.render(ctx);

      // Paddle
      const pw = getCurrentPaddleWidth();
      const px = paddleX - pw / 2;
      ctx.fillStyle = powerSurgeRemaining > 0 ? '#EF4444' : widePaddleRemaining > 0 ? '#10B981' : '#E2E8F0';
      ctx.beginPath();
      ctx.roundRect(px, PADDLE_Y, pw, PADDLE_HEIGHT, 6);
      ctx.fill();

      // Paddle center highlight bar
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(paddleX - 16, PADDLE_Y + 3, 32, 4);

      // Balls & trails
      for (const ball of balls) {
        // Aim guide if waiting to launch
        if (ball.stuckToPaddle) {
          ctx.save();
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(ball.x, ball.y);
          ctx.lineTo(
            ball.x + Math.cos(ball.aimAngle) * 86,
            ball.y + Math.sin(ball.aimAngle) * 86
          );
          ctx.stroke();
          ctx.restore();
        }

        // Trail
        for (let t = 0; t < ball.trail.length; t++) {
          const pt = ball.trail[t];
          const alpha = ((t + 1) / ball.trail.length) * 0.28;
          ctx.fillStyle = powerSurgeRemaining > 0 ? `rgba(239, 68, 68, ${alpha})` : `rgba(245, 158, 11, ${alpha})`;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, ball.radius * ((t + 2) / (ball.trail.length + 2)), 0, Math.PI * 2);
          ctx.fill();
        }

        // Main sphere
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = powerSurgeRemaining > 0 ? '#FCA5A5' : '#F8FAFC';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = powerSurgeRemaining > 0 ? '#EF4444' : '#F59E0B';
        ctx.stroke();
      }

      // Floating texts
      for (const ft of floatingTexts) {
        ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
        ctx.fillStyle = ft.color;
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.globalAlpha = 1;

      // Subtle launch prompt at bottom center if awaiting launch
      if (balls.some((b) => b.stuckToPaddle) && overlayRef.current === 'NONE') {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
        ctx.font = '500 12px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Click arena or press Space to launch', ARENA_WIDTH / 2, PADDLE_Y - 34);
      }

      ctx.restore();
    };

    let lastTime = performance.now();
    let hudTimer = 0;
    let rafId = 0;

    const pushHud = () => {
      const remainingBreakable = bricks.filter((b) => b.kind !== 'obsidian' && b.hp > 0).length;
      callbacksRef.current.onHudUpdate({
        levelId: level.id,
        levelName: level.name,
        score,
        shardsEarned,
        lives,
        maxLives,
        shieldCharges,
        maxShieldCharges,
        bricksRemaining: remainingBreakable,
        totalBreakableBricks,
        elapsedSeconds: Math.floor(elapsedSeconds),
        combo,
        activeBuffs: {
          widePaddleRemaining: Math.ceil(widePaddleRemaining),
          powerSurgeRemaining: Math.ceil(powerSurgeRemaining),
        },
        awaitingLaunch: balls.some((b) => b.stuckToPaddle),
      });
    };

    pushHud();

    const loop = (now: number) => {
      const rawDt = Math.min(0.035, (now - lastTime) / 1000);
      lastTime = now;

      if (overlayRef.current === 'NONE') {
        stepPhysics(rawDt);
        hudTimer += rawDt;
        if (hudTimer >= 0.08) {
          hudTimer = 0;
          pushHud();
        }
      } else if (overlayRef.current === 'LEVEL_COMPLETE') {
        if (screenShake > 0) screenShake = Math.max(0, screenShake - rawDt);
        particleSystem.step(rawDt);
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
          const ft = floatingTexts[i];
          ft.y += ft.vy * rawDt;
          ft.life -= rawDt;
          if (ft.life <= 0) floatingTexts.splice(i, 1);
        }
      }

      drawArena();
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [level, upgrades, runKey]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-auto max-w-[760px] aspect-[760/560] rounded-lg border border-slate-800 bg-[#0F172A] shadow-lg touch-none cursor-crosshair block"
    />
  );
};
