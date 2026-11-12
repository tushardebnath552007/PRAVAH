/**
 * Real-time Web Audio API & Speech Synthesis Engine for PRAVAH ADAS
 * Generates calibrated piezoelectric transducer tones and acoustic driver alerts.
 */

class AudioSynthesizer {
  private audioCtx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Generates a piezoelectric acoustic beep tone with exact frequency and duration
   */
  public playPiezoBeep(frequencyHz = 2400, durationMs = 150, volume = 0.5): void {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square'; // Piezo transducer characteristic
      osc.frequency.setValueAtTime(frequencyHz, ctx.currentTime);

      const now = ctx.currentTime;
      const durationSec = durationMs / 1000;

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(Math.min(1, volume * 0.4), now + 0.02);
      gain.gain.setValueAtTime(Math.min(1, volume * 0.4), now + durationSec - 0.03);
      gain.gain.linearRampToValueAtTime(0.0001, now + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + durationSec + 0.05);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Generates a pulsating AEB emergency braking collision alarm
   */
  public playEmergencyAlarm(): void {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      
      [0, 0.12, 0.24].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(3200, now + offset);
        osc.frequency.exponentialRampToValueAtTime(1400, now + offset + 0.09);

        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(0.35, now + offset + 0.01);
        gain.gain.linearRampToValueAtTime(0.001, now + offset + 0.09);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + 0.1);
      });
    } catch {
      // Audio fallback
    }
  }

  /**
   * Synthesizes automotive voice alert using browser Web Speech API
   */
  public speakAlert(phrase: string): void {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Stop prior queue
        const utterance = new SpeechSynthesisUtterance(phrase);
        utterance.rate = 1.05;
        utterance.pitch = 1.1;
        utterance.volume = 0.9;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // speech fallback
    }
  }
}

export const audioSynth = new AudioSynthesizer();
