// Two soft notes, made with WebAudio so the app ships no sound file.

/** `volume`: 0 to 100. */
export function playChime(volume: number): void {
  const v = Math.max(0, Math.min(100, Number(volume) || 0)) / 100;
  if (!v) return;
  let ctx: AudioContext;
  try {
    ctx = new AudioContext();
  } catch {
    return; // no sound device
  }
  // Ears hear loudness on a curve, so half on the slider should sound like half.
  const peak = 0.32 * v * v;
  const t0 = ctx.currentTime + 0.03;
  const notes: [number, number][] = [[659.25, 0], [987.77, 0.13]];
  for (const [freq, at] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + at);
    osc.stop(t0 + at + 0.55);
  }
  // Closed afterwards, so the app holds no audio stream open while it is silent.
  window.setTimeout(() => void ctx.close().catch(() => {}), 1200);
}
