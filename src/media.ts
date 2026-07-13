export { defineMangoAVMedia, MangoAVMediaElement } from './components/mango-av-media';

import { defineMangoAVMedia } from './components/mango-av-media';
if (typeof window !== 'undefined' && 'customElements' in window) defineMangoAVMedia();
