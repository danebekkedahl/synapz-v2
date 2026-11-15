import { CaptionEvent } from '../types/hockey';

type CaptionListener = (event: CaptionEvent) => void;

class SoundAndHapticsEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private seq = 1;
  private listeners = new Set<CaptionListener>();
  private unlockInstalled = false;

  public installGlobalUnlock(): void {
    if (this.unlockInstalled || typeof window === 'undefined') return;
    this.unlockInstalled = true;
    const unlock = () => {
      const c = this.ensureContext();
      if (c && c.state === 'running') {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('mousedown', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('mousedown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public subscribeCaptions(fn: CaptionListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  public emitCaption(
    text: string,
    tone: CaptionEvent['tone'] = 'cue',
    sfxTag = 'CUES'
  ): void {
    const evt: CaptionEvent = {
      id: this.seq++,
      text,
      tone,
      sfxTag,
      timestamp: Date.now(),
    };
    this.listeners.forEach((fn) => fn(evt));
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    try {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtor) return null;
      if (!this.ctx) {
        this.ctx = new AudioCtor();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private vibrate(pattern: number | number[]): void {
    if (this.muted || typeof navigator === 'undefined') return;
    if (typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore on unsupported devices
      }
    }
  }

  private noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp((-i / len) * 3.2);
    }
    return buf;
  }

  public playSkateCarve(caption?: string): void {
    if (caption) this.emitCaption(caption, 'cue', 'SKATE CARVE');
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 0.18);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1900, now);
    filter.frequency.exponentialRampToValueAtTime(3400, now + 0.16);
    filter.Q.value = 2.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
  }

  public playSnapPass(caption?: string): void {
    if (caption) this.emitCaption(caption, 'cue', 'SNAP PASS');
    this.vibrate(12);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.065);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playSaucerWhoosh(caption?: string): void {
    if (caption) this.emitCaption(caption, 'cue', 'SAUCER PASS');
    this.vibrate([10, 18, 10]);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 0.34);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.exponentialRampToValueAtTime(1650, now + 0.16);
    filter.frequency.exponentialRampToValueAtTime(520, now + 0.32);
    filter.Q.value = 3.1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
  }

  public playShinBlock(caption?: string): void {
    if (caption) this.emitCaption(caption, 'turnover', 'STICK / SHIN BLOCK');
    this.vibrate([28, 30, 28]);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playPostPing(caption?: string): void {
    if (caption) this.emitCaption(caption, 'silver', 'POST PING');
    this.vibrate(22);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [1210, 1835].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(idx === 0 ? 0.18 : 0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.48);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    });
  }

  public playGoalHorn(caption?: string): void {
    if (caption) this.emitCaption(caption, 'gold', 'GOAL HORN');
    this.vibrate([35, 25, 60]);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [116.5, 146.8, 174.6].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(760, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.095, now + 0.04);
      gain.gain.setValueAtTime(0.095, now + 0.42);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.66);
    });
  }

  public playBulletTimeHush(caption?: string): void {
    if (caption) this.emitCaption(caption, 'cue', '25% BULLET-TIME');
    this.vibrate(15);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.17].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 64 : 52, now + offset);
      osc.frequency.exponentialRampToValueAtTime(32, now + offset + 0.13);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.15);
    });
  }

  public playCoachAudio(dataUrl: string | undefined, caption: string): void {
    this.emitCaption(caption, 'voice', 'COACH VOICE');
    if (this.muted || !dataUrl || typeof Audio === 'undefined') return;
    try {
      const audio = new Audio(dataUrl);
      audio.volume = 0.9;
      void audio.play().catch(() => {});
    } catch {
      // Safe fallback to caption bar
    }
  }
}

export const soundEngine = new SoundAndHapticsEngine();
