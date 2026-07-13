export { defineMangoAVAnnotations, MangoAVAnnotationsElement } from './components/mango-av-annotations';

import { defineMangoAVAnnotations } from './components/mango-av-annotations';
if (typeof window !== 'undefined' && 'customElements' in window) defineMangoAVAnnotations();
