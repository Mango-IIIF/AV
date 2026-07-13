export { defineMangoAVChapters, MangoAVChaptersElement } from './components/mango-av-chapters';

import { defineMangoAVChapters } from './components/mango-av-chapters';
if (typeof window !== 'undefined' && 'customElements' in window) defineMangoAVChapters();
