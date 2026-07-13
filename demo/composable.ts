import '../src/index';
import {
  AVPlayerController,
  type MangoAVAnnotationsElement,
  type MangoAVChaptersElement,
  type MangoAVPlayerElement,
  type MangoAVTranscriptElement,
} from '../src/index';
import { videoManifest } from './manifests';
import './styles.css';

const controller = new AVPlayerController({
  panels: { chapters: true, transcript: true, annotations: true },
  transcript: { search: true, autoScroll: true, download: true },
});

const player = document.querySelector<MangoAVPlayerElement>('mango-av-player');
const chapters = document.querySelector<MangoAVChaptersElement>('mango-av-chapters');
const transcript = document.querySelector<MangoAVTranscriptElement>('mango-av-transcript');
const annotations = document.querySelector<MangoAVAnnotationsElement>('mango-av-annotations');
const eventOutput = document.querySelector<HTMLOutputElement>('#component-events');

if (!player || !chapters || !transcript || !annotations || !eventOutput) {
  throw new Error('Composable demo elements could not be initialized.');
}

player.controller = controller;
chapters.controller = controller;
transcript.controller = controller;
annotations.controller = controller;

const eventHistory: string[] = [];

for (const type of ['av-ready', 'av-canvaschange', 'av-play', 'av-pause', 'av-seek', 'av-annotationschange']) {
  controller.addEventListener(type, () => {
    eventHistory.unshift(`${type}: Canvas time ${controller.state.currentTime.toFixed(2)}s`);
    eventOutput.value = eventHistory.slice(0, 6).join('\n');
  });
}

void controller.load(videoManifest);
