let ctx: AudioContext | null = null

/** Short two-tone chime for reminders (no audio asset needed). */
export function playChime(): void {
  try {
    ctx ??= new AudioContext()
    const now = ctx.currentTime
    const notes = [880, 1318.5, 1760]
    notes.forEach((freq, i) => {
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = now + i * 0.16
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      osc.connect(gain).connect(ctx!.destination)
      osc.start(t)
      osc.stop(t + 1)
    })
  } catch {
    /* audio unavailable */
  }
}
