# @mango-iiif/av

IIIF audio and video custom elements, played through [Samvera RAMP](https://github.com/samvera-labs/ramp). The package reads Presentation 2 and Presentation 3 manifests and exposes an all-in-one element, independently placeable components, and a typed controller API.

The elements are framework-free to use. RAMP is a React and Video.js library, so React, RAMP and Video.js are installed as dependencies. They are loaded with a dynamic import the first time a player renders, so pages that only use the panels or the controller never download them.

## Install

```sh
npm install @mango-iiif/av
```

## Complete media experience

`<mango-av-media>` puts the RAMP player first, then the playback position, then the transcript, chapters, annotations, metadata and supplemental files in tabs underneath:

```ts
import '@mango-iiif/av';
import type { MangoAVMediaElement } from '@mango-iiif/av';

const media = document.querySelector<MangoAVMediaElement>('mango-av-media')!;

media.config = {
  panels: {
    chapters: true,
    transcript: true,
    annotations: true,
    metadata: true,
    supplementalFiles: true,
  },
  controls: {
    navigation: false,
    autoAdvance: false,
    captions: true,
    playbackRate: true,
    pictureInPicture: true,
    fullscreen: true,
  },
  audioArt: { title: 'Listen to this recording' },
  resume: { enabled: true },
};

media.manifest = 'https://example.org/iiif/manifest.json';
```

It can also be configured from HTML when only JSON-compatible options are needed:

```html
<mango-av-media
  manifest-url="https://example.org/iiif/manifest.json"
  config='{"panels":{"transcript":true},"autoAdvance":false}'
></mango-av-media>
```

## Independently placeable components

The player, chapters, transcript, and annotations can be placed anywhere in an application. Assign the same `AVPlayerController` to each element so actions and state changes synchronize across all of them:

```html
<main><mango-av-player></mango-av-player></main>
<aside><mango-av-chapters></mango-av-chapters></aside>
<section><mango-av-transcript></mango-av-transcript></section>
<aside><mango-av-annotations></mango-av-annotations></aside>
```

```ts
import { AVPlayerController } from '@mango-iiif/av/core';
import '@mango-iiif/av/player';
import '@mango-iiif/av/chapters';
import '@mango-iiif/av/transcript';
import '@mango-iiif/av/annotations';
import { type MangoAVPlayerElement } from '@mango-iiif/av/player';
import { type MangoAVChaptersElement } from '@mango-iiif/av/chapters';
import { type MangoAVTranscriptElement } from '@mango-iiif/av/transcript';
import { type MangoAVAnnotationsElement } from '@mango-iiif/av/annotations';

const controller = new AVPlayerController();

document.querySelector<MangoAVPlayerElement>('mango-av-player')!.controller = controller;
document.querySelector<MangoAVChaptersElement>('mango-av-chapters')!.controller = controller;
document.querySelector<MangoAVTranscriptElement>('mango-av-transcript')!.controller = controller;
document.querySelector<MangoAVAnnotationsElement>('mango-av-annotations')!.controller = controller;

await controller.load(manifest);
```

The controller is an `EventTarget`. A chapter selection calls `selectCanvas`, a transcript or annotation selection calls `seekTo`, and every connected component reacts to the resulting typed controller events. Components do not need a common DOM parent.

Use one `<mango-av-player>` per controller. Any number of display or interaction components can share that controller, including components rendered in different framework components, panels, or portals.

```ts
const unsubscribe = controller.on('av-timeupdate', ({ detail }) => {
  console.log(detail.canvasId, detail.time);
});
```

## Translations

Override any package-owned interface string with the typed, partial `strings` configuration. Unspecified values keep their English defaults, and the same controller dictionary is used by every connected standalone component:

```ts
const controller = new AVPlayerController({
  preferredLanguages: ['cy', 'en', 'none'],
  strings: {
    chapters: 'Penodau',
    transcript: 'Trawsgrifiad',
    previous: 'Blaenorol',
    next: 'Nesaf',
    searchTranscript: 'Chwilio’r trawsgrifiad',
    sourceNumber: 'Ffynhonnell {number}',
  },
});
```

`preferredLanguages` chooses localized IIIF labels and is passed to RAMP, which loads the matching Video.js dictionary for the player controls. `strings` covers the Mango AV wrapper UI and generated fallback labels for any language. The complete English dictionary is exported as `defaultStrings` for building and validating translation files.

## Svelte

The element works as a normal custom element. The future Mango integration does not need a wrapper library:

```svelte
<script lang="ts">
  import '@mango-iiif/av';
  import type { AVPlayerConfig } from '@mango-iiif/av';

  const config: AVPlayerConfig = {
    panels: { chapters: true, transcript: true },
  };
</script>

<mango-av-media manifest-url={manifestUrl} .config={config}></mango-av-media>
```

For Svelte versions that do not accept property syntax in markup, bind the element and assign `element.config` in an effect.

## Controller-only API

Use the controller when an application owns its own UI:

```ts
import { AVPlayerController } from '@mango-iiif/av/core';

const controller = new AVPlayerController({ autoAdvance: true });
const manifest = await controller.load(manifestJson);

controller.attachMedia(document.querySelector('video')!);
controller.selectCanvas(manifest.canvases[1].id, { time: 12.5 });
await controller.play();
```

## Styling and themes

The component maps its theme to public CSS custom properties. This gives the host full control of the look without depending on private shadow-DOM selectors:

```css
mango-av-media.tailwind-audio,
mango-av-player.tailwind-audio,
mango-av-chapters.tailwind-audio,
mango-av-transcript.tailwind-audio,
mango-av-annotations.tailwind-audio {
  --mango-av-accent: #0f172a;
  --mango-av-accent-contrast: #f8fafc;
  --mango-av-background: #f8fafc;
  --mango-av-surface: #e2e8f0;
  --mango-av-text: #0f172a;
  --mango-av-border: #cbd5e1;
  --mango-av-radius: 0.875rem;
  --mango-av-font: Inter, ui-sans-serif, system-ui;
  --mango-av-list-height: 30rem;
}
```

A theme set on `<mango-av-media>` reaches the player and panels inside it. See [docs/API.md](docs/API.md) for the full property list. The player controls wear Video.js's default skin.

The complete element provides `header`, `before-player` and `after-player` slots. The standalone player provides `stage`, for content shown with the media such as captions, and `after-player`. The information components provide a `heading` slot.

## Audio captions

Audio can read like video: `<mango-av-captions>` shows the line being spoken, with the lines either side faded. In `<mango-av-media>`, set `audioArt: { captions: 'context' }` (or `'line'`). In a layout of your own, put it in a player's `stage` slot, or anywhere else, on the same controller:

```html
<mango-av-transcript></mango-av-transcript>
<mango-av-player>
  <mango-av-captions slot="stage"></mango-av-captions>
</mango-av-player>
```

`npm run dev` and open `/captions.html` to see both.

Run `npm run dev` to use the interactive configuration builder and the linked composable-components demonstration. They include Video, HLS, and Audio presets, feature switches, generated API configuration, independently positioned components, and multiple style recipes.

## Supported IIIF AV behavior

- Presentation 2 sequences and Presentation 3 Canvas items
- Audio, video and HLS, played by RAMP's Video.js
- `Choice` and multiple painting bodies, media source selection, temporal fragments, and clipped playback
- Multi-Canvas previous/next, `start`/`startCanvas`, `auto-advance`, and `repeat`
- Nested Range navigation and temporal chapters
- Inline and external supplementing annotations
- Captions, subtitles, audio descriptions, transcript selection, search, download, and synchronized scrolling
- WebVTT, SRT, plain text, structured JSON, and inline TextualBody transcripts
- Commenting, supplementing, transcribing, tagging, and highlighting annotations
- Manifest/Canvas metadata, rights, required statements, homepages, and `rendering` downloads
- Placeholder posters, request resolution for protected media, and service metadata normalization
- Optional persisted playback positions, through RAMP's resume cache
- Configurable annotation create/update/delete adapters

See [API.md](docs/API.md) for the complete API and [FEATURE_PARITY.md](docs/FEATURE_PARITY.md) for feature coverage.

## Development

```sh
npm install
npm run dev
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run pack:check
```

## License

MIT
