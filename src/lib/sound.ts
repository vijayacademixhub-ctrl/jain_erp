/**
 * Short two-tone alert for critical clashes, generated with the Web Audio API
 * (no audio files). Created lazily on first use, after a user gesture.
 */
let ctx: AudioContext | null = null;

export function playClashAlert(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    const tone = (freq: number, start: number, dur: number) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    };
    tone(880, 0, 0.14);
    tone(660, 0.16, 0.2);
  } catch {
    /* audio unavailable: silently ignore */
  }
}
