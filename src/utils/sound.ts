class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    gainVal: number,
    delay = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public paddleHit() {
    this.playTone(320, 440, 0.075, 'triangle', 0.14);
  }

  public wallHit() {
    this.playTone(190, 140, 0.05, 'sine', 0.08);
  }

  public brickHit(combo = 1) {
    const pitch = Math.min(880, 360 + combo * 28);
    this.playTone(pitch, pitch * 1.12, 0.07, 'triangle', 0.11);
  }

  public brickBreak(combo = 1) {
    const pitch = Math.min(1040, 460 + combo * 35);
    this.playTone(pitch, pitch * 1.35, 0.11, 'sine', 0.14);
  }

  public armorClang() {
    this.playTone(160, 120, 0.09, 'square', 0.07);
  }

  public bumperPing() {
    this.playTone(580, 920, 0.14, 'sine', 0.14);
  }

  public portalWarp() {
    this.playTone(280, 740, 0.18, 'sine', 0.12);
    this.playTone(520, 240, 0.16, 'triangle', 0.07, 0.04);
  }

  public explosion() {
    this.playTone(130, 38, 0.24, 'sawtooth', 0.16);
    this.playTone(90, 30, 0.28, 'triangle', 0.14, 0.02);
  }

  public shardCollect() {
    this.playTone(760, 1140, 0.09, 'sine', 0.1);
  }

  public powerUp() {
    this.playTone(440, 660, 0.1, 'triangle', 0.12);
    this.playTone(660, 880, 0.12, 'triangle', 0.12, 0.08);
  }

  public shieldDeflect() {
    this.playTone(260, 520, 0.16, 'sine', 0.15);
  }

  public ballLost() {
    this.playTone(260, 110, 0.26, 'sawtooth', 0.12);
  }

  public levelClear() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, n, 0.2, 'triangle', 0.13, idx * 0.085);
    });
  }

  public upgradePurchase() {
    this.playTone(480, 720, 0.1, 'triangle', 0.12);
    this.playTone(720, 960, 0.14, 'sine', 0.12, 0.07);
  }
}

export const sound = new SoundEngine();
