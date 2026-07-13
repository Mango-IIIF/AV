export { defineMangoAVTranscript, MangoAVTranscriptElement } from './components/mango-av-transcript';

import { defineMangoAVTranscript } from './components/mango-av-transcript';
if (typeof window !== 'undefined' && 'customElements' in window) defineMangoAVTranscript();
