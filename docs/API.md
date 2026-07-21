# API reference

## Entry points

- `@mango-iiif/av` exports the complete API and registers all Mango AV custom elements in a browser.
- `@mango-iiif/av/core` exports parsing, types, transcript helpers, and `AVPlayerController` without registering a custom element.
- `@mango-iiif/av/media`, `/player`, `/chapters`, `/transcript`, and `/annotations` register and export only the selected element.

## Components

| Element | Purpose |
| --- | --- |
| `<mango-av-media>` | Complete precomposed player, navigation, transcript, annotations, metadata, and files. |
| `<mango-av-player>` | Media Chrome audio/video playback and Canvas/source controls only. |
| `<mango-av-chapters>` | Independently placeable structured Range navigation. |
| `<mango-av-transcript>` | Independently placeable synchronized transcript, selector, search, and download UI. |
| `<mango-av-annotations>` | Independently placeable synchronized annotation UI. |

## `<mango-av-media>`

### Attributes

| Attribute | Type | Purpose |
| --- | --- | --- |
| `manifest-url` | URL | Fetch and load a IIIF Presentation 2 or 3 Manifest. |
| `config` | JSON string | Set JSON-compatible `AVPlayerConfig` fields. Function hooks must be assigned through the property API. |

### Properties and methods

| Member | Type | Purpose |
| --- | --- | --- |
| `manifest` | `JsonObject \| string` | Manifest object, raw JSON, or URL. Setting it loads the resource. |
| `config` | `AVPlayerConfig` | Runtime configuration, including callbacks. |
| `controller` | `AVPlayerController` | Shared state and playback controller. The legacy `player` alias exposes the same instance. |
| `load(input)` | `Promise<AVManifest>` | Load and normalize a manifest. |
| `play()` | `Promise<void>` | Begin playback. |
| `pause()` | `void` | Pause playback. |
| `seekTo(seconds)` | `void` | Seek within the active source/segment. |
| `selectCanvas(indexOrId, options?)` | `AVCanvas \| undefined` | Change Canvas and optionally seek/autoplay. |

### Slots

| Slot | Location |
| --- | --- |
| `header` | Replaces the default manifest title and summary. |
| `before-player` | Before the Media Chrome controller. |
| `player-overlay` | Inside the Media Chrome controller, above media. |
| `controls` | Replaces the default Media Chrome controls and menus. |
| `after-player` | After the player and toolbar. |

## Standalone components

Every standalone component has a `controller: AVPlayerController` property. Assign the same controller instance to any components that should synchronize:

```ts
const controller = new AVPlayerController();

player.controller = controller;
chapters.controller = controller;
transcript.controller = controller;
annotations.controller = controller;

await controller.load(manifest);
```

The elements can be in unrelated parts of the document or application component tree. Communication occurs through the controller rather than DOM ancestry.

Use one `<mango-av-player>` per controller because the controller attaches to one active media element. Any number of chapters, transcript, annotations, or application-owned views can share it.

Use the component subpath entry points when an application should bundle only selected UI elements:

```ts
import '@mango-iiif/av/player';
import '@mango-iiif/av/chapters';
import '@mango-iiif/av/transcript';
```

Subscribe to the same typed event stream from application code with `controller.on()`:

```ts
const unsubscribe = controller.on('av-canvaschange', (event) => {
  console.log(event.detail.canvas, event.detail.canvasIndex);
});

unsubscribe();
```

## Translations

`AVPlayerConfig.strings` accepts `Partial<AVStrings>`. Overrides are merged with `defaultStrings`, so a translation can be introduced incrementally and all unspecified strings remain English.

```ts
import { AVPlayerController, defaultStrings, type AVStrings } from '@mango-iiif/av/core';

const welsh: Partial<AVStrings> = {
  chapters: 'Penodau',
  transcript: 'Trawsgrifiad',
  previous: 'Blaenorol',
  next: 'Nesaf',
  sourceNumber: 'Ffynhonnell {number}',
  resumePrompt: 'Parhau o {time}?',
};

const controller = new AVPlayerController({
  preferredLanguages: ['cy', 'en', 'none'],
  strings: welsh,
});
```

The placeholders `{number}`, `{time}`, `{status}`, `{statusText}`, and `{type}` are retained until rendering. Translation values can therefore be supplied through either the TypeScript API or the JSON `config` attribute. `controller.configure({ strings })` updates all connected components and emits `av-configchange`.

String keys cover:

- panel, navigation, download, search, resume, and accessibility labels;
- loading, error, and empty states;
- generated IIIF fallback labels such as `sourceNumber`, `transcriptNumber`, `sectionNumber`, `chapterNumber`, and `untitledManifest`.

`preferredLanguages` separately controls which language is selected from IIIF language maps. It is also applied to Media Chrome's `lang` attribute. German, Spanish, French, Portuguese, Simplified Chinese, and Traditional Chinese Media Chrome dictionaries are loaded automatically when selected; custom Mango AV strings work with any language.

### `<mango-av-player>`

The standalone player supports `manifest`, `config`, `load`, `play`, `pause`, `seekTo`, and `selectCanvas`, as well as the `manifest-url` and JSON `config` attributes. Its slots are `overlay` and `controls`.

### `<mango-av-chapters>`

Renders nested IIIF Ranges. Selecting a chapter calls `controller.selectCanvas()` and emits the bubbling `av-chapterselect` DOM event.

### `<mango-av-transcript>`

Loads the active Canvas transcript and follows controller time. Selecting a timed cue calls `controller.seekTo()` and `controller.play()`. It emits `av-transcriptcueselect` and `av-transcriptsearch`. The heading can be replaced through the `heading` slot.

### `<mango-av-annotations>`

Renders and follows the active Canvas annotations. Selecting a timed annotation calls `controller.seekTo()` and `controller.play()`. It emits `av-annotationselect`. The heading can be replaced through the `heading` slot.

### CSS custom properties

| Property | Default |
| --- | --- |
| `--mango-av-accent` | `#5b3fd6` |
| `--mango-av-accent-contrast` | `#fff` |
| `--mango-av-background` | `#fff` |
| `--mango-av-surface` | `#f5f5f8` |
| `--mango-av-text` | `#18181b` |
| `--mango-av-muted` | `#62626a` |
| `--mango-av-border` | `#d7d7de` |
| `--mango-av-radius` | `.65rem` |
| `--mango-av-font` | system sans-serif |
| `--mango-av-panel-width` | `24rem` |
| `--mango-av-player-aspect-ratio` | `16 / 9` |

For audio Canvases, `audioArt.transcript` replaces the artwork title with the current timed cue. The preceding and following cues remain visible at reduced opacity and slide as playback crosses cue boundaries. `audioArt.visualizer` accepts `'pulse'`, `'waveform'`, `'spectrum'`, `true` (an alias for `'pulse'`), or `false`. Every mode inherits `--mango-av-accent`, fades out completely during silence or pause, and reduces or removes movement when `prefers-reduced-motion: reduce` is active.

Media Chrome's own public variables remain available and can override the mapped defaults.

## `AVPlayerConfig`

```ts
interface AVPlayerConfig {
  controls?: {
    navigation?: boolean;
    autoAdvance?: boolean;
    seek?: boolean;
    volume?: boolean;
    captions?: boolean;
    playbackRate?: boolean;
    pictureInPicture?: boolean;
    fullscreen?: boolean;
    sourceSelector?: boolean;
    download?: boolean;
    skipSeconds?: number;
  };
  panels?: {
    chapters?: boolean;
    transcript?: boolean;
    annotations?: boolean;
    metadata?: boolean;
    supplementalFiles?: boolean;
  };
  transcript?: {
    autoScroll?: boolean;
    search?: boolean;
    download?: boolean;
    showNotes?: boolean;
    showMetadata?: boolean;
    showSearchMarkers?: boolean;
  };
  audioArt?: {
    title?: string;
    transcript?: boolean;
    visualizer?: boolean | 'pulse' | 'waveform' | 'spectrum';
  };
  resume?: {
    enabled?: boolean;
    maxItems?: number;
    ttlDays?: number;
    prompt?: boolean;
  };
  strings?: Partial<AVStrings>;
  preferredLanguages?: string[];
  autoAdvance?: boolean;
  repeat?: boolean;
  startCanvasId?: string;
  startTime?: number;
  activePanel?: 'chapters' | 'transcript' | 'annotations' | 'metadata' | 'files' | 'none';
  crossorigin?: 'anonymous' | 'use-credentials' | '';
  preload?: 'none' | 'metadata' | 'auto';
  playbackRates?: number[];
  fetch?: typeof globalThis.fetch;
  requestInit?: RequestInit;
  resolveRequest?: (url, context) => string | Promise<string>;
  annotationAdapter?: AVAnnotationAdapter;
}
```

`audioArt.title` sets optional text in the audio artwork. It defaults to `''`, so no title is displayed unless the host supplies one. The Canvas label remains the audio element's accessible name. When synchronized artwork transcripts are enabled and cues are available, the cues replace the configured title.

`controls.navigation` shows the Previous and Next buttons, while `controls.autoAdvance` shows the Auto-advance checkbox. Both default to `false`; hiding them does not disable `controller.previous()`, `controller.next()`, or programmatic auto-advance.

`crossorigin` defaults to `''`, so ordinary media does not add a `crossorigin` attribute. When an audio visualizer is enabled, a cross-origin HTTP(S) source instead uses an implicit `anonymous` policy so Web Audio can safely inspect it. If that implicit CORS load fails, the player replaces the audio element and retries once without Web Audio or CORS, preserving audible HTML media playback.

An explicitly supplied `crossorigin` value is always retained. Explicit `'anonymous'` and `'use-credentials'` failures surface as normal media errors and are never retried with weaker security. An explicit empty string keeps ordinary no-CORS loading; for a cross-origin source, visualization is disabled to avoid routing silent samples through Web Audio.

`fetch` and `requestInit` configure manifest, external AnnotationPage, and transcript requests. `resolveRequest` runs immediately before a media URL is assigned; it can obtain an IIIF Auth token, sign a URL, route through a proxy, or enforce an application's access policy. The normalized Canvas exposes discovered auth services to the callback through `context.canvas.authServices`.

`annotationAdapter` connects create/update/delete to the host's persistence API:

```ts
media.config = {
  annotationAdapter: {
    create: async (canvas, draft) => api.create(canvas.id, draft),
    update: async (canvas, annotation) => api.update(canvas.id, annotation),
    remove: async (canvas, annotation) => api.remove(canvas.id, annotation.id),
  },
};

await media.controller.createAnnotation({
  text: 'Important passage',
  time: { start: 12, end: 18 },
  motivation: ['highlighting'],
});
```

If no adapter is supplied, annotation mutations are local for the current session.

## `AVPlayerController`

Playback methods:

- `load`, `attachMedia`, `detachMedia`, and `destroy`
- `play`, `pause`, `stop`, `seekTo`, and `seekBy`
- `selectCanvas`, `next`, `previous`, and `selectSource`
- `setAutoAdvance` and `setRepeat`
- `getSavedPosition` and `resolvedSourceUrl`
- `createAnnotation`, `updateAnnotation`, and `removeAnnotation`
- `on(event, listener)`, which returns an unsubscribe function

Read-only properties are `config`, `state`, `manifest`, `canvas`, `source`, and `media`.

## Events

`AVPlayerController` is the canonical cross-component event bus. It emits the events below to every component sharing that instance. `<mango-av-media>` and `<mango-av-player>` also expose controller events as bubbling, composed DOM `CustomEvent`s for host application integration.

| Event | Detail |
| --- | --- |
| `av-loadstart` | Input source |
| `av-ready` | Normalized manifest |
| `av-error` | `Error` |
| `av-canvaschange` | Canvas and index |
| `av-sourcechange` | Media source and index |
| `av-play`, `av-pause`, `av-ended` | Canvas ID and playback position where applicable |
| `av-timeupdate`, `av-seek` | Timeline values |
| `av-annotationschange` | Active Canvas annotation list |
| `av-configchange` | Resolved controller configuration |
| `av-statechange` | Complete `AVPlayerState` snapshot |
| `av-visualizerfallback` | `{ canvasId, sourceUrl, reason: 'cors' }` when ordinary audio playback replaces a failed implicit-CORS visualizer load |

## Parsing helpers

`normalizeManifest(input, options)` is the version boundary. It returns the same `AVManifest` model for IIIF Presentation 2 and 3.

`parseTimedText`, `parseTranscript`, and `loadTranscript` support WebVTT, SRT, plain text, and structured JSON. `parseTime`, `parseTemporalFragment`, and `formatTime` are also public.
