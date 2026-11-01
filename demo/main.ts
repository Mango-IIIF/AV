import '../src/index';
import type { AVPlayerConfig, MangoAVMediaElement } from '../src/index';
import { manifests } from './manifests';
import './styles.css';

const player = document.querySelector<MangoAVMediaElement>('#player');
const preset = document.querySelector<HTMLSelectElement>('#preset');
const manifestForm = document.querySelector<HTMLFormElement>('#manifest-form');
const manifestUrl = document.querySelector<HTMLInputElement>('#manifest-url');
const loadManifest = document.querySelector<HTMLButtonElement>('#load-manifest');
const language = document.querySelector<HTMLSelectElement>('#language');
const featureControls = document.querySelector<HTMLElement>('#feature-controls');
const generatedCode = document.querySelector<HTMLElement>('#generated-code');
const eventStatus = document.querySelector<HTMLElement>('#event-status');

if (!player || !preset || !manifestForm || !manifestUrl || !loadManifest || !language || !featureControls || !generatedCode || !eventStatus) {
  throw new Error('Demo controls could not be initialized.');
}

const features = [
  ['chapters', 'Chapters', true],
  ['transcript', 'Transcript', true],
  ['annotations', 'Annotations', true],
  ['metadata', 'Metadata', true],
  ['supplementalFiles', 'Supplemental files', true],
  ['captions', 'Captions', true],
  ['playbackRate', 'Playback rates', true],
  ['pictureInPicture', 'Picture in picture', true],
  ['fullscreen', 'Fullscreen', true],
  ['fileDownload', 'Download control', false],
  ['navigation', 'Previous and next controls', false],
  ['autoAdvance', 'Auto-advance control', false],
  ['resume', 'Resume position', false],
] as const;

featureControls.innerHTML = features.map(([id, text, checked]) => `
  <label><input type="checkbox" data-feature="${id}" ${checked ? 'checked' : ''}> ${text}</label>
`).join('');

const featureEnabled = (name: string): boolean =>
  featureControls.querySelector<HTMLInputElement>(`[data-feature="${name}"]`)?.checked ?? false;

const translations = {
  en: {},
  cy: {
    preferredLanguages: ['cy', 'en', 'none'],
    strings: {
      chapters: 'Penodau', transcript: 'Trawsgrifiad', annotations: 'Anodiadau', files: 'Ffeiliau',
      previous: 'Blaenorol', next: 'Nesaf', previousSection: 'Adran flaenorol', nextSection: 'Adran nesaf',
      autoAdvance: 'Symud ymlaen yn awtomatig',
      mediaSource: 'Ffynhonnell cyfryngau', download: 'Lawrlwytho', searchTranscript: 'Chwilio’r trawsgrifiad',
      noTranscript: 'Nid oes trawsgrifiad ar gael.', noAnnotations: 'Nid oes anodiadau ar gael.',
    },
  },
  fr: {
    preferredLanguages: ['fr', 'en', 'none'],
    strings: {
      chapters: 'Chapitres', transcript: 'Transcription', annotations: 'Annotations', files: 'Fichiers',
      previous: 'Précédent', next: 'Suivant', previousSection: 'Section précédente', nextSection: 'Section suivante',
      autoAdvance: 'Avance automatique',
      mediaSource: 'Source multimédia', download: 'Télécharger', searchTranscript: 'Rechercher dans la transcription',
      noTranscript: 'Aucune transcription disponible.', noAnnotations: 'Aucune annotation disponible.',
    },
  },
} satisfies Record<string, AVPlayerConfig>;

const config = (): AVPlayerConfig => ({
  ...translations[language.value as keyof typeof translations],
  panels: {
    chapters: featureEnabled('chapters'),
    transcript: featureEnabled('transcript'),
    annotations: featureEnabled('annotations'),
    metadata: featureEnabled('metadata'),
    supplementalFiles: featureEnabled('supplementalFiles'),
  },
  controls: {
    navigation: featureEnabled('navigation'),
    autoAdvance: featureEnabled('autoAdvance'),
    captions: featureEnabled('captions'),
    playbackRate: featureEnabled('playbackRate'),
    pictureInPicture: featureEnabled('pictureInPicture'),
    fullscreen: featureEnabled('fullscreen'),
    seek: true,
    volume: true,
    sourceSelector: true,
    download: featureEnabled('fileDownload'),
  },
  transcript: {
    search: true,
    autoScroll: true,
    download: true,
  },
  resume: {
    enabled: featureEnabled('resume'),
  },
  autoAdvance: featureEnabled('autoAdvance'),
});

const updateCode = () => {
  const manifestAssignment = typeof player.manifest === 'string'
    ? JSON.stringify(player.manifest)
    : 'manifest';
  generatedCode.textContent = `import '@mango-iiif/av';

const player = document.querySelector('mango-av-media');
player.config = ${JSON.stringify(config(), null, 2)};
player.manifest = ${manifestAssignment};

/* Theme */
player.style.setProperty('--mango-av-accent', '${getComputedStyle(player).getPropertyValue('--mango-av-accent').trim() || '#5b3fd6'}');`;
};

const update = () => {
  player.config = config();
  updateCode();
};

preset.addEventListener('change', () => {
  if (preset.value === 'custom') return;
  player.manifest = manifests[preset.value as keyof typeof manifests];
  updateCode();
});
manifestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = manifestUrl.value.trim();
  if (!url) return;

  loadManifest.disabled = true;
  eventStatus.textContent = 'Loading manifest…';
  try {
    await player.load(url);
    preset.value = 'custom';
    eventStatus.textContent = 'Custom manifest loaded';
    updateCode();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    eventStatus.textContent = `Could not load manifest: ${message}`;
  } finally {
    loadManifest.disabled = false;
  }
});
language.addEventListener('change', update);
featureControls.addEventListener('change', update);

const bindStyle = (selector: string, property: string, unit = '') => {
  document.querySelector<HTMLInputElement>(selector)?.addEventListener('input', (event) => {
    player.style.setProperty(property, `${(event.target as HTMLInputElement).value}${unit}`);
    updateCode();
  });
};
bindStyle('#accent', '--mango-av-accent');
bindStyle('#background', '--mango-av-background');
bindStyle('#radius', '--mango-av-radius', 'px');
bindStyle('#list-height', '--mango-av-list-height', 'px');

document.querySelector('#copy-code')?.addEventListener('click', async () => {
  await navigator.clipboard.writeText(generatedCode.textContent ?? '');
  eventStatus.textContent = 'Configuration copied';
});

document.querySelectorAll<HTMLElement>('[data-theme]').forEach((button) => button.addEventListener('click', () => {
  const theme = button.dataset.theme;
  const values = theme === 'tailwind'
    ? { accent: '#0f172a', background: '#f8fafc', surface: '#e2e8f0', radius: '14px', font: 'Inter, ui-sans-serif, system-ui' }
    : theme === 'archive'
      ? { accent: '#f59e0b', background: '#18181b', surface: '#27272a', radius: '2px', font: 'Georgia, serif' }
      : { accent: '#5b3fd6', background: '#ffffff', surface: '#f5f5f8', radius: '10px', font: 'ui-sans-serif, system-ui' };
  player.style.setProperty('--mango-av-accent', values.accent);
  player.style.setProperty('--mango-av-background', values.background);
  player.style.setProperty('--mango-av-surface', values.surface);
  player.style.setProperty('--mango-av-radius', values.radius);
  player.style.setProperty('--mango-av-font', values.font);
  player.style.setProperty('--mango-av-text', theme === 'archive' ? '#fafafa' : '#18181b');
  player.style.setProperty('--mango-av-muted', theme === 'archive' ? '#b4b4bc' : '#62626a');
  player.style.setProperty('--mango-av-border', theme === 'archive' ? '#44444a' : '#d7d7de');
  updateCode();
}));

for (const type of ['av-ready', 'av-canvaschange', 'av-sourcechange', 'av-error']) {
  player.addEventListener(type, () => { eventStatus.textContent = type; });
}

player.config = config();
player.manifest = manifests.video;
updateCode();
