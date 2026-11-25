import { BrickKind } from '../types/game';

const MAX_PARTICLES = 420;
const DEBRIS_GRAVITY = 420;
const CONFETTI_GRAVITY = 155;

interface BrickPalette {
  fill: string;
  stroke: string;
  spark: string;
}

const BRICK_PALETTES: Record<BrickKind, BrickPalette> = {
  ceramic: { fill: '#0284C7', stroke: '#38BDF8', spark: '#7DD3FC' },
  armored: { fill: '#334155', stroke: '#94A3B8', spark: '#E2E8F0' },
  crystal: { fill: '#065F46', stroke: '#10B981', spark: '#6EE7B7' },
  explosive: { fill: '#991B1B', stroke: '#EF4444', spark: '#FCA5A5' },
  obsidian: { fill: '#111827', stroke: '#475569', spark: '#CBD5E1' },
  core: { fill: '#78350F', stroke: '#F59E0B', spark: '#FDE68A' },
};

const VICTORY_PALETTE = [
  '#F59E0B', // amber gold
  '#38BDF8', // sky
  '#10B981', // emerald
  '#FB7185', // coral rose
  '#FDE68A', // pale gold
  '#F8FAFC', // crisp white
];

interface ScheduledBurst {
  delay: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  primary: string;
  secondary: string;
}

type ParticleItem =
  | {
      kind: 'spark';
      x: number;
      y: number;
      vx: number;
      vy: number;
      gravity: number;
      life: number;
      maxLife: number;
      length: number;
      width: number;
      coreColor: string;
      fadeColor: string;
      drag: number;
    }
  | {
      kind: 'chip';
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      w: number;
      h: number;
      angle: number;
      spin: number;
      fill: string;
      stroke: string;
    }
  | {
      kind: 'sparkle';
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
      swayPhase: number;
      swayFreq: number;
      color: string;
    }
  | {
      kind: 'ring';
      x: number;
      y: number;
      startRadius: number;
      maxRadius: number;
      life: number;
      maxLife: number;
      lineWidth: number;
      color: string;
    }
  | {
      kind: 'confetti';
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      w: number;
      h: number;
      angle: number;
      spin: number;
      tiltPhase: number;
      tiltSpeed: number;
      swayPhase: number;
      swayFreq: number;
      color: string;
    }
  | {
      kind: 'rocket';
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      trailTimer: number;
      primary: string;
      secondary: string;
    };

export class ParticleSystem {
  private items: ParticleItem[] = [];
  private scheduledBursts: ScheduledBurst[] = [];
  private reducedMotion: boolean;

  constructor() {
    this.reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  public isReducedMotion(): boolean {
    return this.reducedMotion;
  }

  private scaleCount(count: number): number {
    if (!this.reducedMotion) return count;
    return Math.max(1, Math.round(count * 0.45));
  }

  private push(item: ParticleItem) {
    if (this.items.length >= MAX_PARTICLES) {
      this.items.shift();
    }
    this.items.push(item);
  }

  public clear() {
    this.items.length = 0;
    this.scheduledBursts.length = 0;
  }

  public emitSparks(
    x: number,
    y: number,
    fadeColor: string,
    count: number,
    speed = 190,
    coreColor = '#FEF3C7',
    gravity = 0
  ) {
    const n = this.scaleCount(count);
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const mag = (0.45 + Math.random() * 0.75) * speed;
      const maxLife = 0.22 + Math.random() * 0.18;
      this.push({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag,
        gravity,
        life: maxLife,
        maxLife,
        length: 6 + Math.random() * 7,
        width: 1.5 + Math.random() * 1,
        coreColor,
        fadeColor,
        drag: 0.08,
      });
    }
  }

  public emitBrickHit(
    x: number,
    y: number,
    brickKind: BrickKind,
    nx = 0,
    ny = 1
  ) {
    const palette = BRICK_PALETTES[brickKind];
    const baseAngle = Math.atan2(ny, nx);
    const n = this.scaleCount(5);

    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * 1.5;
      const angle = nx === 0 && ny === 0 ? Math.random() * Math.PI * 2 : baseAngle + spread;
      const mag = 110 + Math.random() * 130;
      const maxLife = 0.2 + Math.random() * 0.14;
      this.push({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag,
        gravity: 0,
        life: maxLife,
        maxLife,
        length: 5 + Math.random() * 6,
        width: 1.5,
        coreColor: '#F8FAFC',
        fadeColor: palette.spark,
        drag: 0.1,
      });
    }
  }

  public emitBrickShatter(
    x: number,
    y: number,
    w: number,
    h: number,
    brickKind: BrickKind
  ) {
    const palette = BRICK_PALETTES[brickKind];
    const isCore = brickKind === 'core';
    const chipCount = this.scaleCount(isCore ? 14 : 7);
    const sparkCount = this.scaleCount(isCore ? 20 : 9);

    for (let i = 0; i < chipCount; i++) {
      const px = x + Math.random() * w;
      const py = y + Math.random() * h;
      const dx = px - (x + w / 2);
      const dy = py - (y + h / 2);
      const outAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.7;
      const mag = (isCore ? 120 : 80) + Math.random() * 135;
      const maxLife = 0.45 + Math.random() * 0.28;

      this.push({
        kind: 'chip',
        x: px,
        y: py,
        vx: Math.cos(outAngle) * mag,
        vy: Math.sin(outAngle) * mag - 55,
        life: maxLife,
        maxLife,
        w: 4 + Math.random() * 4.5,
        h: 3 + Math.random() * 3.5,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 14,
        fill: palette.fill,
        stroke: palette.stroke,
      });
    }

    this.emitSparks(
      x + w / 2,
      y + h / 2,
      palette.spark,
      sparkCount,
      isCore ? 260 : 195,
      '#FEF3C7'
    );

    if (isCore) {
      this.emitRing(x + w / 2, y + h / 2, 115, '#F59E0B', 0.36, 3.5);
    }
  }

  public emitExplosion(x: number, y: number) {
    this.emitRing(x, y, 108, '#EF4444', 0.32, 3.5);
    this.emitRing(x, y, 64, '#F59E0B', 0.22, 2);

    const sparkCount = this.scaleCount(22);
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const mag = 160 + Math.random() * 210;
      const maxLife = 0.24 + Math.random() * 0.22;
      this.push({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag,
        gravity: 0,
        life: maxLife,
        maxLife,
        length: 8 + Math.random() * 9,
        width: 2,
        coreColor: '#FEF3C7',
        fadeColor: i % 2 === 0 ? '#EF4444' : '#F59E0B',
        drag: 0.06,
      });
    }

    const chipCount = this.scaleCount(8);
    for (let i = 0; i < chipCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const mag = 110 + Math.random() * 165;
      const maxLife = 0.45 + Math.random() * 0.25;
      this.push({
        kind: 'chip',
        x,
        y,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag - 70,
        life: maxLife,
        maxLife,
        w: 4.5 + Math.random() * 4,
        h: 3.5 + Math.random() * 3,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 16,
        fill: '#7F1D1D',
        stroke: '#F59E0B',
      });
    }
  }

  public emitShardCollect(x: number, y: number) {
    this.emitRing(x, y, 36, '#F59E0B', 0.28, 2.5);

    const sparkleCount = this.scaleCount(7);
    for (let i = 0; i < sparkleCount; i++) {
      const maxLife = 0.38 + Math.random() * 0.22;
      this.push({
        kind: 'sparkle',
        x: x + (Math.random() - 0.5) * 18,
        y: y - Math.random() * 4,
        vx: (Math.random() - 0.5) * 44,
        vy: -(75 + Math.random() * 65),
        life: maxLife,
        maxLife,
        size: 2.5 + Math.random() * 2.5,
        swayPhase: Math.random() * Math.PI * 2,
        swayFreq: 10 + Math.random() * 6,
        color: i % 3 === 0 ? '#FEF3C7' : '#F59E0B',
      });
    }
  }

  public emitPowerUpCollect(x: number, y: number, color: string) {
    this.emitRing(x, y, 48, color, 0.3, 2.5);
    const sparkleCount = this.scaleCount(8);
    for (let i = 0; i < sparkleCount; i++) {
      const maxLife = 0.36 + Math.random() * 0.2;
      this.push({
        kind: 'sparkle',
        x: x + (Math.random() - 0.5) * 28,
        y,
        vx: (Math.random() - 0.5) * 65,
        vy: -(85 + Math.random() * 70),
        life: maxLife,
        maxLife,
        size: 2.5 + Math.random() * 2,
        swayPhase: Math.random() * Math.PI * 2,
        swayFreq: 9 + Math.random() * 5,
        color,
      });
    }
  }

  public emitRing(
    x: number,
    y: number,
    maxRadius: number,
    color: string,
    duration = 0.28,
    lineWidth = 2.5
  ) {
    this.push({
      kind: 'ring',
      x,
      y,
      startRadius: 6,
      maxRadius,
      life: duration,
      maxLife: duration,
      lineWidth,
      color,
    });
  }

  public emitConfettiCannon(
    originX: number,
    originY: number,
    aimAngle: number,
    spread: number,
    count: number
  ) {
    const n = this.scaleCount(count);
    for (let i = 0; i < n; i++) {
      const angle = aimAngle + (Math.random() - 0.5) * spread;
      const speed = 220 + Math.random() * 210;
      const maxLife = 1.85 + Math.random() * 1.1;
      const color = VICTORY_PALETTE[Math.floor(Math.random() * VICTORY_PALETTE.length)];
      this.push({
        kind: 'confetti',
        x: originX + (Math.random() - 0.5) * 14,
        y: originY + (Math.random() - 0.5) * 14,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: maxLife,
        maxLife,
        w: 6 + Math.random() * 4,
        h: 3.5 + Math.random() * 2,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 10,
        tiltPhase: Math.random() * Math.PI * 2,
        tiltSpeed: 7 + Math.random() * 7,
        swayPhase: Math.random() * Math.PI * 2,
        swayFreq: 3.5 + Math.random() * 3.5,
        color,
      });
    }
  }

  public emitFireworkBurst(
    x: number,
    y: number,
    primary = '#F59E0B',
    secondary = '#38BDF8'
  ) {
    this.emitRing(x, y, 76, primary, 0.36, 2.5);
    this.emitRing(x, y, 42, '#FEF3C7', 0.22, 1.5);

    const emberCount = this.scaleCount(28);
    for (let i = 0; i < emberCount; i++) {
      const baseAngle = (i / emberCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.14;
      const mag = 115 + Math.random() * 130;
      const maxLife = 0.52 + Math.random() * 0.35;
      this.push({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(baseAngle) * mag,
        vy: Math.sin(baseAngle) * mag,
        gravity: 95,
        life: maxLife,
        maxLife,
        length: 8 + Math.random() * 8,
        width: 1.8 + Math.random() * 0.8,
        coreColor: '#FFFFFF',
        fadeColor: i % 3 === 0 ? secondary : primary,
        drag: 0.08,
      });
    }

    const sparkleCount = this.scaleCount(7);
    for (let i = 0; i < sparkleCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const mag = 35 + Math.random() * 75;
      const maxLife = 0.55 + Math.random() * 0.3;
      this.push({
        kind: 'sparkle',
        x,
        y,
        vx: Math.cos(ang) * mag,
        vy: Math.sin(ang) * mag - 15,
        life: maxLife,
        maxLife,
        size: 3 + Math.random() * 2,
        swayPhase: Math.random() * Math.PI * 2,
        swayFreq: 6 + Math.random() * 5,
        color: i % 2 === 0 ? '#FEF3C7' : primary,
      });
    }
  }

  public emitVictoryBurst(arenaWidth: number, arenaHeight: number) {
    if (this.reducedMotion) {
      this.emitRing(arenaWidth / 2, arenaHeight / 2 - 40, 140, '#F59E0B', 0.5, 3);
      this.emitFireworkBurst(110, 120, '#F59E0B', '#38BDF8');
      this.emitFireworkBurst(arenaWidth - 110, 120, '#10B981', '#FDE68A');
      this.emitConfettiCannon(arenaWidth / 2, arenaHeight * 0.2, Math.PI / 2, 2.2, 20);
      return;
    }

    // Immediate left & right confetti cannons framing the victory modal
    this.emitConfettiCannon(58, arenaHeight - 36, -Math.PI * 0.36, 0.58, 34);
    this.emitConfettiCannon(arenaWidth - 58, arenaHeight - 36, -Math.PI * 0.64, 0.58, 34);

    // Top-edge confetti shower
    this.emitConfettiCannon(arenaWidth * 0.25, 22, Math.PI * 0.5, 1.1, 14);
    this.emitConfettiCannon(arenaWidth * 0.75, 22, Math.PI * 0.5, 1.1, 14);

    // Immediate opening firework burst above center
    this.emitFireworkBurst(arenaWidth * 0.5, 76, '#F59E0B', '#FDE68A');

    // Staggered firework rockets launching into visible perimeter zones
    const salvos: ScheduledBurst[] = [
      {
        delay: 0.14,
        startX: 115,
        startY: arenaHeight - 24,
        targetX: 105,
        targetY: 112,
        primary: '#38BDF8',
        secondary: '#F8FAFC',
      },
      {
        delay: 0.28,
        startX: arenaWidth - 115,
        startY: arenaHeight - 24,
        targetX: arenaWidth - 105,
        targetY: 108,
        primary: '#10B981',
        secondary: '#F59E0B',
      },
      {
        delay: 0.55,
        startX: 90,
        startY: arenaHeight - 24,
        targetX: 98,
        targetY: 255,
        primary: '#FB7185',
        secondary: '#FDE68A',
      },
      {
        delay: 0.72,
        startX: arenaWidth - 90,
        startY: arenaHeight - 24,
        targetX: arenaWidth - 98,
        targetY: 250,
        primary: '#F59E0B',
        secondary: '#38BDF8',
      },
      {
        delay: 1.05,
        startX: 135,
        startY: arenaHeight - 24,
        targetX: 122,
        targetY: 145,
        primary: '#FDE68A',
        secondary: '#10B981',
      },
      {
        delay: 1.2,
        startX: arenaWidth - 135,
        startY: arenaHeight - 24,
        targetX: arenaWidth - 122,
        targetY: 145,
        primary: '#38BDF8',
        secondary: '#FB7185',
      },
    ];

    for (const s of salvos) {
      this.scheduledBursts.push({ ...s });
    }
  }

  private launchRocket(burst: ScheduledBurst) {
    const travelTime = 0.28 + Math.random() * 0.1;
    this.push({
      kind: 'rocket',
      x: burst.startX,
      y: burst.startY,
      vx: (burst.targetX - burst.startX) / travelTime,
      vy: (burst.targetY - burst.startY) / travelTime,
      life: travelTime,
      maxLife: travelTime,
      trailTimer: 0,
      primary: burst.primary,
      secondary: burst.secondary,
    });
  }

  public step(dt: number) {
    // Process scheduled firework launches
    for (let i = this.scheduledBursts.length - 1; i >= 0; i--) {
      const b = this.scheduledBursts[i];
      b.delay -= dt;
      if (b.delay <= 0) {
        this.launchRocket(b);
        this.scheduledBursts.splice(i, 1);
      }
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;

      if (p.kind === 'rocket') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.trailTimer += dt;
        if (p.trailTimer >= 0.025) {
          p.trailTimer = 0;
          this.push({
            kind: 'spark',
            x: p.x,
            y: p.y,
            vx: (Math.random() - 0.5) * 28,
            vy: 40 + Math.random() * 35,
            gravity: 0,
            life: 0.16,
            maxLife: 0.16,
            length: 4,
            width: 1.4,
            coreColor: '#FEF3C7',
            fadeColor: p.primary,
            drag: 0.2,
          });
        }
        if (p.life <= 0) {
          const rx = p.x;
          const ry = p.y;
          const primary = p.primary;
          const secondary = p.secondary;
          this.items.splice(i, 1);
          this.emitFireworkBurst(rx, ry, primary, secondary);
        }
        continue;
      }

      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }

      if (p.kind === 'spark') {
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const damp = Math.pow(p.drag, dt);
        p.vx *= damp;
        p.vy *= damp;
      } else if (p.kind === 'chip') {
        p.vy += DEBRIS_GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.45, dt);
        p.angle += p.spin * dt;
      } else if (p.kind === 'sparkle') {
        const age = p.maxLife - p.life;
        p.x += (p.vx + Math.sin(age * p.swayFreq + p.swayPhase) * 28) * dt;
        p.y += p.vy * dt;
        p.vy *= Math.pow(0.55, dt);
      } else if (p.kind === 'confetti') {
        const age = p.maxLife - p.life;
        p.vy += CONFETTI_GRAVITY * dt;
        p.vx *= Math.pow(0.28, dt);
        p.vy = Math.min(p.vy, 165);
        p.x += (p.vx + Math.sin(age * p.swayFreq + p.swayPhase) * 34) * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        p.tiltPhase += p.tiltSpeed * dt;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D) {
    if (this.items.length === 0) return;

    ctx.save();
    for (const p of this.items) {
      const t = Math.max(0, Math.min(1, p.life / p.maxLife));

      if (p.kind === 'ring') {
        const progress = 1 - t;
        const eased = 1 - Math.pow(1 - progress, 3);
        const radius = p.startRadius + (p.maxRadius - p.startRadius) * eased;
        ctx.globalAlpha = t * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.75, p.lineWidth * t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'chip') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, t * 1.4);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        const scale = 0.55 + 0.45 * t;
        const cw = p.w * scale;
        const ch = p.h * scale;
        ctx.fillStyle = p.fill;
        ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = 1;
        ctx.strokeRect(-cw / 2, -ch / 2, cw, ch);
        ctx.restore();
      } else if (p.kind === 'confetti') {
        const flutterY = Math.cos(p.tiltPhase);
        ctx.save();
        ctx.globalAlpha = Math.min(1, t * 2.2);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.scale(1, Math.abs(flutterY) < 0.2 ? 0.2 : flutterY);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      } else if (p.kind === 'rocket') {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = '#FEF3C7';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'spark') {
        const spd = Math.hypot(p.vx, p.vy);
        if (spd > 1) {
          const nx = p.vx / spd;
          const ny = p.vy / spd;
          const tailLen = Math.min(p.length, spd * 0.045) * (0.4 + 0.6 * t);
          ctx.globalAlpha = t;
          ctx.strokeStyle = t > 0.65 ? p.coreColor : p.fadeColor;
          ctx.lineWidth = Math.max(0.8, p.width * t);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x - nx * tailLen, p.y - ny * tailLen);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      } else if (p.kind === 'sparkle') {
        const s = p.size * (0.5 + 0.5 * Math.sin((1 - t) * Math.PI));
        ctx.save();
        ctx.globalAlpha = t;
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.35);
        ctx.lineTo(s * 0.45, -s * 0.45);
        ctx.lineTo(s * 1.35, 0);
        ctx.lineTo(s * 0.45, s * 0.45);
        ctx.lineTo(0, s * 1.35);
        ctx.lineTo(-s * 0.45, s * 0.45);
        ctx.lineTo(-s * 1.35, 0);
        ctx.lineTo(-s * 0.45, -s * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
