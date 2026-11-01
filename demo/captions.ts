import '../src/index';
import {
  AVPlayerController,
  type AVAudioArtConfig,
  type MangoAVCaptionsElement,
  type MangoAVMediaElement,
  type MangoAVPlayerElement,
  type MangoAVTranscriptElement,
} from '../src/index';
import { captionsManifest } from './manifests';
import './styles.css';

const media = document.querySelector<MangoAVMediaElement>('#built-in');
const mode = document.querySelector<HTMLSelectElement>('#captions-mode');
const code = document.querySelector<HTMLElement>('#built-in-code');
const transcript = document.querySelector<MangoAVTranscriptElement>('#own-transcript');
const player = document.querySelector<MangoAVPlayerElement>('#own-player');
const captions = document.querySelector<MangoAVCaptionsElement>('#own-captions');

if (!media || !mode || !code || !transcript || !player || !captions) {
  throw new Error('Captions demo elements could not be initialized.');
}

/* Built in: the complete element shows captions in its audio card. */
const captionsSetting = (): NonNullable<AVAudioArtConfig['captions']> =>
  mode.value === 'off' ? false : mode.value as 'line' | 'context';

const configure = () => {
  media.config = {
    audioArt: { captions: captionsSetting() },
    panels: { chapters: false, metadata: false, supplementalFiles: false },
  };
  code.textContent = `media.config = {
  audioArt: { captions: ${JSON.stringify(captionsSetting())} },
};`;
};

mode.addEventListener('change', configure);
configure();
media.manifest = captionsManifest;

/* Your own layout: separate pieces on one controller. */
const controller = new AVPlayerController({ transcript: { search: false } });
for (const element of [transcript, player, captions]) element.controller = controller;
void controller.load(captionsManifest);
