export * from './core';
export { defineMangoAVMedia, MangoAVMediaElement } from './components/mango-av-media';
export { defineMangoAVPlayer, MangoAVPlayerElement } from './components/mango-av-player';
export { defineMangoAVChapters, MangoAVChaptersElement } from './components/mango-av-chapters';
export { defineMangoAVTranscript, MangoAVTranscriptElement } from './components/mango-av-transcript';
export { defineMangoAVAnnotations, MangoAVAnnotationsElement } from './components/mango-av-annotations';

import { defineMangoAVMedia } from './components/mango-av-media';
import { defineMangoAVPlayer } from './components/mango-av-player';
import { defineMangoAVChapters } from './components/mango-av-chapters';
import { defineMangoAVTranscript } from './components/mango-av-transcript';
import { defineMangoAVAnnotations } from './components/mango-av-annotations';

if (typeof window !== 'undefined' && 'customElements' in window) {
  defineMangoAVMedia();
  defineMangoAVPlayer();
  defineMangoAVChapters();
  defineMangoAVTranscript();
  defineMangoAVAnnotations();
}

declare global {
  interface HTMLElementTagNameMap {
    'mango-av-media': import('./components/mango-av-media').MangoAVMediaElement;
    'mango-av-player': import('./components/mango-av-player').MangoAVPlayerElement;
    'mango-av-chapters': import('./components/mango-av-chapters').MangoAVChaptersElement;
    'mango-av-transcript': import('./components/mango-av-transcript').MangoAVTranscriptElement;
    'mango-av-annotations': import('./components/mango-av-annotations').MangoAVAnnotationsElement;
  }
}
