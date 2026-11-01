export { defineMangoAVCaptions, MangoAVCaptionsElement } from './components/mango-av-captions';

import { defineMangoAVCaptions } from './components/mango-av-captions';
if (typeof window !== 'undefined' && 'customElements' in window) defineMangoAVCaptions();
