// Som sintetizado na hora. Nenhum arquivo de áudio: mantém o jogo em ~700 KB e
// evita a política do iOS de bloquear carregamento de mídia. O contexto só nasce
// depois de um toque, que é o que o Safari exige.

export class Som {
  constructor() {
    this.ctx = null;
    this.ligado = true;
    this.ruido = null;
  }

  acordar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.mestre = this.ctx.createGain();
    this.mestre.gain.value = 0.5;
    this.mestre.connect(this.ctx.destination);

    // um buffer de ruído reaproveitado por todos os tiros
    const n = this.ctx.sampleRate * 0.5;
    this.ruido = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 1.6;
  }

  get pronto() { return this.ctx && this.ligado; }

  /** Estouro: ruído filtrado + um corpo grave. */
  estouro({ volume = 0.6, corte = 2400, queda = 0.16, grave = 90 } = {}) {
    if (!this.pronto) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.ruido;
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.setValueAtTime(corte, t);
    filtro.frequency.exponentialRampToValueAtTime(Math.max(180, corte * 0.18), t + queda);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + queda);
    src.connect(filtro).connect(g).connect(this.mestre);
    src.start(t);
    src.stop(t + queda + 0.02);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(grave, t);
    osc.frequency.exponentialRampToValueAtTime(grave * 0.45, t + 0.09);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(volume * 0.7, t);
    g2.gain.exponentialRampToValueAtTime(0.0008, t + 0.11);
    osc.connect(g2).connect(this.mestre);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  bip(freq, dur = 0.05, volume = 0.18, tipo = 'square') {
    if (!this.pronto) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = tipo;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    o.connect(g).connect(this.mestre);
    o.start(t);
    o.stop(t + dur + 0.01);
  }

  tiroJogador()      { this.estouro({ volume: 0.62, corte: 3200, queda: 0.19, grave: 105 }); }
  tiroInimigo(dist)  {
    const f = Math.max(0.12, 1 - dist / 70);
    this.estouro({ volume: 0.34 * f, corte: 900 + 1500 * f, queda: 0.22, grave: 70 });
  }
  acerto()           { this.bip(1500, 0.035, 0.2, 'square'); }
  morteInimigo()     { this.bip(680, 0.09, 0.22, 'sawtooth'); }
  gatilhoVazio()     { this.bip(2400, 0.02, 0.1, 'square'); }
  recarga()          { this.bip(340, 0.05, 0.14, 'square'); setTimeout(() => this.bip(500, 0.05, 0.12, 'square'), 190); }
  garandPing()       { this.bip(2100, 0.5, 0.16, 'triangle'); }   // o clangor do bloco saindo
  ferido()           { this.estouro({ volume: 0.3, corte: 500, queda: 0.3, grave: 55 }); }
}
