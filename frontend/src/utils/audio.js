// Web Audio API Sound Synthesizer for DevRank Platform
// Zero external file dependencies - pure Web Audio API

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSound(type, soundEnabled = true) {
  if (!soundEnabled) return;
  
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'levelup' || type === 'success') {
      // Futuristic ascending triad chord
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + (index * 0.06));
        gain.gain.setValueAtTime(0.2, now + (index * 0.06));
        gain.gain.exponentialRampToValueAtTime(0.001, now + (index * 0.06) + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + (index * 0.06));
        osc.stop(now + (index * 0.06) + 0.35);
      });
    } else if (type === 'badge') {
      // Cyberpunk unlock arpeggio
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + (idx * 0.08));
        gain.gain.setValueAtTime(0.15, now + (idx * 0.08));
        gain.gain.exponentialRampToValueAtTime(0.001, now + (idx * 0.08) + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + (idx * 0.08));
        osc.stop(now + (idx * 0.08) + 0.25);
      });
    } else if (type === 'apply') {
      // Soft chime confirmation
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (err) {
    // Silent fail if audio context blocked before user gesture
  }
}
