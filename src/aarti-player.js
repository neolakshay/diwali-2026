import { AARTI_CUES, getLyricFrame } from './aarti-lyrics.js';
import { translate } from './i18n.js';

export function createAartiPlayer(root = document, i18n) {
  const audio = root.querySelector('#aarti-audio');
  const currentLine = root.querySelector('#aarti-current-line');
  const nextLine = root.querySelector('#aarti-next-line');
  const status = root.querySelector('#aarti-status');
  const replayButton = root.querySelector('#aarti-replay');
  const scriptButtons = root.querySelectorAll('[data-lyrics-script]');
  const uiLanguage = () => i18n?.language ?? 'en';
  const t = (key) => i18n ? i18n.t(key) : translate('en', key);
  let script = uiLanguage() === 'hi' ? 'hindi' : 'romanized';
  let renderedFrame = '';
  let statusKey = 'aartiReady';

  function setStatus(key) {
    statusKey = key;
    status.textContent = t(key);
  }

  function renderScriptButtons() {
    scriptButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.lyricsScript === script)));
  }

  function syncLyrics() {
    const { current, next } = getLyricFrame(audio.currentTime, AARTI_CUES);
    const key = `${current?.start ?? 'gap'}:${next?.start ?? 'end'}:${script}:${audio.ended}:${uiLanguage()}`;
    if (key === renderedFrame) return;
    renderedFrame = key;
    const language = script === 'hindi' ? 'hi' : 'hi-Latn';
    currentLine.lang = current ? language : uiLanguage();
    nextLine.lang = language;
    currentLine.textContent = audio.ended
      ? t('aartiFarewell')
      : current?.[script] ?? t('aartiInterlude');
    if (audio.ended) currentLine.lang = uiLanguage();
    nextLine.textContent = audio.ended ? '' : next?.[script] ?? '';
  }

  async function play() {
    if (audio.ended) audio.currentTime = 0;
    syncLyrics();
    setStatus('aartiPreparing');
    try {
      await audio.play();
    } catch (error) {
      if (error.name === 'AbortError') return;
      setStatus(error.name === 'NotAllowedError' ? 'aartiBlocked' : 'aartiPlayError');
    }
  }

  for (const name of ['timeupdate', 'seeked', 'loadedmetadata']) audio.addEventListener(name, syncLyrics);
  audio.addEventListener('playing', () => {
    setStatus('aartiPlaying');
    syncLyrics();
  });
  audio.addEventListener('pause', () => {
    if (!audio.ended) setStatus('aartiPaused');
  });
  audio.addEventListener('waiting', () => {
    setStatus('aartiWaiting');
  });
  audio.addEventListener('ended', () => {
    setStatus('aartiEnded');
    syncLyrics();
  });
  audio.addEventListener('error', () => {
    setStatus('aartiLoadError');
  });
  replayButton.addEventListener('click', () => {
    audio.currentTime = 0;
    syncLyrics();
    play();
  });
  scriptButtons.forEach((button) => {
    button.addEventListener('click', () => {
      script = button.dataset.lyricsScript;
      renderScriptButtons();
      syncLyrics();
    });
  });

  i18n?.subscribe(() => {
    script = uiLanguage() === 'hi' ? 'hindi' : 'romanized';
    renderScriptButtons();
    syncLyrics();
    setStatus(statusKey);
  });
  renderScriptButtons();
  setStatus(statusKey);
  syncLyrics();
  return { play, pause: () => audio.pause() };
}
