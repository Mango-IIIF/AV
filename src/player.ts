export { defineMangoAVPlayer, MangoAVPlayerElement } from './components/mango-av-player';

import { defineMangoAVPlayer } from './components/mango-av-player';
if (typeof window !== 'undefined' && 'customElements' in window) defineMangoAVPlayer();
