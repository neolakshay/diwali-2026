// Original procedural sound: no recordings, downloads, or third-party sound library.
export function createSoundscape(root = document, i18n) {
  const host = root.defaultView ?? window;
  const button = root.querySelector('#sound-toggle');
  const AudioContext = host.AudioContext ?? host.webkitAudioContext;
  let available = Boolean(AudioContext);
  let enabled = true;
  let storage;
  try {
    storage = host.localStorage;
    enabled = storage?.getItem('diwali-effects') !== 'off';
  } catch { /* Sound still works when storage is blocked. */ }
  let context;
  let master;
  let ambience;
  let fire;
  let whiteNoise;
  let scene = 'entry';
  let lit = false;
  let pageHidden = false;
  let disposed = false;
  const loops = [];
  const voices = new Set();

  function render() {
    button.disabled = !available;
    button.textContent = i18n.t(!available ? 'effectsUnavailable' : enabled ? 'effectsOn' : 'effectsOff');
    button.setAttribute('aria-pressed', String(available && enabled));
    button.setAttribute('aria-label', i18n.t(!available ? 'effectsUnavailable' : enabled ? 'muteEffects' : 'unmuteEffects'));
  }

  const hidden = () => pageHidden || root.hidden;
  const audible = () => enabled && !hidden() && !['entry', 'aarti', 'quiet'].includes(scene);
  const canPlay = () => !disposed && audible() && context?.state === 'running';

  function stopEffects() {
    for (const voice of [...voices]) {
      try { voice.source.stop(); } catch { /* A scheduled source may already have ended. */ }
      voice.cleanup();
    }
  }

  function mix() {
    if (!context || disposed) return;
    const now = context.currentTime;
    master.gain.setTargetAtTime(audible() ? .55 : 0, now, .035);
    ambience.gain.setTargetAtTime(audible() ? .09 : 0, now, .4);
    fire.gain.setTargetAtTime(audible() && scene === 'diya' && lit ? .055 : 0, now, .15);
    if (!audible()) stopEffects();
  }

  function noise(kind) {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let brown = 0;
    let spark = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + white * .02) / 1.02;
      spark = Math.random() < .0007 ? Math.random() : spark * .93;
      samples[index] = kind === 'brown' ? brown * 3.5 : kind === 'fire' ? white * (spark * .6 + .015) : white;
    }
    return buffer;
  }

  function loop(buffer, output, cutoff) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    source.connect(filter).connect(output);
    source.start();
    loops.push(source);
  }

  async function unlock() {
    if (!available || !enabled || disposed) return;
    if (!context) {
      try {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = 0;
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -18;
        limiter.knee.value = 18;
        limiter.ratio.value = 8;
        master.connect(limiter).connect(context.destination);
        ambience = context.createGain();
        ambience.gain.value = 0;
        ambience.connect(master);
        fire = context.createGain();
        fire.gain.value = 0;
        fire.connect(master);
        whiteNoise = noise('white');
        loop(noise('brown'), ambience, 650);
        loop(noise('fire'), fire, 4200);
        for (const frequency of [130.81, 196]) {
          const tone = context.createOscillator();
          const gain = context.createGain();
          tone.type = 'sine';
          tone.frequency.value = frequency;
          gain.gain.value = .055;
          tone.connect(gain).connect(ambience);
          tone.start();
          loops.push(tone);
        }
      } catch {
        available = false;
        context?.close().catch(() => {});
        context = null;
        render();
        return;
      }
    }
    try {
      if (context.state === 'suspended') await context.resume();
      mix();
    } catch { /* A later user gesture can retry a browser-blocked resume. */ }
  }

  function track(source, nodes) {
    const voice = { source, cleanup() {
      voices.delete(voice);
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
    } };
    voices.add(voice);
    source.onended = voice.cleanup;
  }

  function noiseShot(duration, peak, startFrequency, endFrequency, attack = .015) {
    if (!canPlay()) return;
    const now = context.currentTime;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = whiteNoise;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(startFrequency, now);
    filter.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter).connect(gain).connect(master);
    track(source, [filter, gain]);
    source.start(now);
    source.stop(now + duration);
  }

  function toneShot(duration, peak, startFrequency, endFrequency) {
    if (!canPlay()) return;
    const now = context.currentTime;
    const source = context.createOscillator();
    const gain = context.createGain();
    source.type = 'sine';
    source.frequency.setValueAtTime(startFrequency, now);
    source.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(gain).connect(master);
    track(source, [gain]);
    source.start(now);
    source.stop(now + duration);
  }

  function setScene(next) {
    stopEffects();
    scene = next;
    lit = false;
    mix();
  }

  function lightDiya() {
    lit = true;
    mix();
    if (scene === 'diya') noiseShot(.85, .18, 2400, 450, .06);
  }

  function launch(index) {
    if (scene !== 'skyshot') return;
    toneShot(.9, .025, 420 + index * 70, 1500 + index * 110);
    noiseShot(.65, .035, 1800, 3500, .08);
  }

  function burst() {
    if (scene !== 'skyshot') return;
    noiseShot(1.35, .32, 3600, 350, .006);
    toneShot(.65, .12, 95, 32);
  }

  function onVisibility() {
    mix();
    if (!context || disposed) return;
    if (hidden()) context.suspend().catch(() => {});
    else if (audible()) unlock();
  }
  const onPageHide = () => { pageHidden = true; onVisibility(); };
  const onPageShow = () => { pageHidden = false; onVisibility(); };
  function toggle() {
    if (!available || disposed) return;
    enabled = !enabled;
    try { storage?.setItem('diwali-effects', enabled ? 'on' : 'off'); } catch { /* Optional preference. */ }
    render();
    mix();
    if (enabled) unlock();
  }

  button.addEventListener('click', toggle);
  root.addEventListener?.('visibilitychange', onVisibility);
  host.addEventListener?.('pagehide', onPageHide);
  host.addEventListener?.('pageshow', onPageShow);
  const unsubscribe = i18n.subscribe(render);
  render();

  return {
    unlock, setScene, lightDiya, launch, burst,
    dispose() {
      if (disposed) return;
      disposed = true;
      stopEffects();
      loops.forEach((source) => source.stop());
      context?.close().catch(() => {});
      button.removeEventListener('click', toggle);
      root.removeEventListener?.('visibilitychange', onVisibility);
      host.removeEventListener?.('pagehide', onPageHide);
      host.removeEventListener?.('pageshow', onPageShow);
      unsubscribe();
    },
  };
}
