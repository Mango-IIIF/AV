# @mango-iiif/av

Framework-free IIIF audio and video components powered by [Media Chrome](https://www.media-chrome.org/). The package reads Presentation 2 and Presentation 3 manifests and exposes an all-in-one element, independently placeable components, and a typed controller API. It has no React or Svelte runtime dependency.

## Install

```sh
npm install @mango-iiif/av
```

## Complete media experience

`<mango-av-media>` contains the player, chapters, transcript, annotations, metadata, and supplemental files:

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
  audioArt: {
    title: 'Listen to this recording',
    transcript: true,
    visualizer: 'waveform',
  },
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
    resumePrompt: 'Parhau o {time}?',
  },
});
```

`preferredLanguages` chooses localized IIIF labels and sets the Media Chrome language. The package automatically loads Media Chrome's bundled German, Spanish, French, Portuguese, and Chinese dictionaries. `strings` covers the Mango AV wrapper UI and generated fallback labels for any language. The complete English dictionary is exported as `defaultStrings` for building and validating translation files.

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
  --mango-av-panel-width: 26rem;
}
```

Media Chrome variables such as `--media-primary-color` and `--media-secondary-color` can also be set directly. The complete element provides `header`, `before-player`, `player-overlay`, `controls`, and `after-player` slots. The standalone player provides `overlay` and `controls`; the information components provide a `heading` slot.

Run `npm run dev` to use the interactive configuration builder and the linked composable-components demonstration. They include Video, HLS, and Audio presets, feature switches, generated API configuration, independently positioned components, and multiple style recipes.

## Supported IIIF AV behavior

- Presentation 2 sequences and Presentation 3 Canvas items
- Audio, video, native HLS, and hls.js-backed HLS through `<hls-video>`
- `Choice` and multiple painting bodies, media source selection, temporal fragments, and clipped playback
- Multi-Canvas previous/next, `start`/`startCanvas`, `auto-advance`, and `repeat`
- Nested Range navigation and temporal chapters
- Inline and external supplementing annotations
- Captions, subtitles, audio descriptions, transcript selection, search, download, and synchronized scrolling
- WebVTT, SRT, plain text, structured JSON, and inline TextualBody transcripts
- Commenting, supplementing, transcribing, tagging, and highlighting annotations
- Manifest/Canvas metadata, rights, required statements, homepages, and `rendering` downloads
- Placeholder posters, request resolution for protected media, and service metadata normalization
- Optional persisted playback positions
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
