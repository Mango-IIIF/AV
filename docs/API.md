# API reference

## Entry points

- `@mango-iiif/av` exports the complete API and registers all Mango AV custom elements in a browser.
- `@mango-iiif/av/core` exports parsing, types, transcript helpers, and `AVPlayerController` without registering a custom element.
- `@mango-iiif/av/media`, `/player`, `/chapters`, `/transcript`, `/annotations` and `/captions` register and export only the selected element.

## Components

| Element | Purpose |
| --- | --- |
| `<mango-av-media>` | The player with its position, and the transcript, chapters, annotations, metadata and files in tabs beneath it. |
| `<mango-av-player>` | Audio and video playback through [Samvera RAMP](https://github.com/samvera-labs/ramp), with Canvas and source controls. |
| `<mango-av-chapters>` | Independently placeable structured Range navigation. |
| `<mango-av-transcript>` | Independently placeable synchronized transcript, selector, search, and download UI. |
| `<mango-av-annotations>` | Independently placeable synchronized annotation UI. |
| `<mango-av-captions>` | The line being spoken, shown as captions are on video. |

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
| `before-player` | Before the player. |
| `after-player` | After the player and toolbar, before the position and tabs. |

### Layout

Under the player, a position line reads `Position 0:12 / 3:45`. Below it, segmented tabs hold the Transcript, Chapters, Annotations, Metadata and Files panels, in that order, for the panels enabled in `config.panels`. `activePanel` chooses the tab shown first and defaults to `'transcript'`; `'none'` hides the tabs. The tabs are the standalone `<mango-av-transcript>`, `<mango-av-chapters>` and `<mango-av-annotations>` elements, sharing the element's controller, so they look and behave the same in both places.

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
  searchTranscript: 'Chwilio’r trawsgrifiad',
};

const controller = new AVPlayerController({
  preferredLanguages: ['cy', 'en', 'none'],
  strings: welsh,
});
```

The placeholders `{number}`, `{time}`, `{status}`, `{statusText}`, and `{type}` are retained until rendering. Translation values can therefore be supplied through either the TypeScript API or the JSON `config` attribute. `controller.configure({ strings })` updates all connected components and emits `av-configchange`.

String keys cover:

- panel, navigation, download, search, position and accessibility labels;
- loading, error, and empty states;
- generated IIIF fallback labels such as `sourceNumber`, `transcriptNumber`, `sectionNumber`, `chapterNumber`, and `untitledManifest`.

`preferredLanguages` separately controls which language is selected from IIIF language maps. Its first language other than `none` is also passed to RAMP, which loads the matching Video.js dictionary for the player controls when one exists. Custom Mango AV strings work with any language.

### `<mango-av-player>`

The standalone player supports `manifest`, `config`, `load`, `play`, `pause`, `seekTo`, and `selectCanvas`, as well as the `manifest-url` and JSON `config` attributes. It has two slots:

- `stage` holds content shown with the media. For audio it sits in the card, above the controls; for video it overlays the foot of the picture, clear of the controls, and lets clicks through to the player. `<mango-av-captions>` is made for it.
- `after-player` sits between the player and its toolbar.

RAMP renders the controls and the media element. React, RAMP and Video.js are loaded with a dynamic import the first time a player renders, so pages that only use the panels or the controller don't download them. The player gives RAMP a Presentation 3 Manifest holding only the active Canvas and source, rebuilt from the normalized model. Presentation 2 Manifests, `resolveRequest` and the source selector therefore work as before, and Canvas navigation stays with the controller. The controller attaches to RAMP's media element, so `controller.media`, playback state and events behave as they do for any media element.

| Control | Setting |
| --- | --- |
| Play, progress bar, time, volume, fullscreen | Always offered; `controls.seek`, `controls.volume` and `controls.fullscreen` hide them |
| Skip back and forward | Shown with `controls.seek`; `controls.skipSeconds` is rounded to the nearest of 5, 10 or 30, the lengths Video.js allows |
| Captions | `controls.captions`, when the Canvas has caption or subtitle files |
| Playback rate | `controls.playbackRate`, offering `playbackRates` |
| Picture in picture | `controls.pictureInPicture`, video only |
| Download | `controls.download`, offering the Manifest and Canvas `rendering` files |
| Quality | Shown by RAMP when it has several sources to choose between |
| Previous, Next, Auto-advance, source | `controls.navigation`, `controls.autoAdvance`, `controls.sourceSelector`, in the toolbar under the player |

Audio Canvases show a card in place of a picture: the Canvas poster or Manifest thumbnail, a `Recording` eyebrow, and `audioArt.title`, which defaults to the Manifest label.

### `<mango-av-chapters>`

Renders nested IIIF Ranges as rows of start time and label. The chapter being heard is highlighted. Selecting a chapter calls `controller.selectCanvas()` and emits the bubbling `av-chapterselect` DOM event. The heading can be replaced through the `heading` slot.

### `<mango-av-transcript>`

Loads the active Canvas transcript, with a `Find in transcript` search above rows of cue time and text. The cue being heard is highlighted, and while playing it is kept at the top of the list; paused, the list stays where the user scrolled. Selecting a timed cue calls `controller.seekTo()` and `controller.play()`. It emits `av-transcriptcueselect` and `av-transcriptsearch`. The heading can be replaced through the `heading` slot.

### `<mango-av-annotations>`

Renders the active Canvas annotations as rows of start time (or `—` for untimed annotations), text and tags, highlighting those being heard. Selecting a timed annotation calls `controller.seekTo()` and `controller.play()`. It emits `av-annotationselect`. The heading can be replaced through the `heading` slot.

### `<mango-av-captions>`

Shows the active Canvas transcript as captions: the line being spoken, large, with the lines either side faded. It reads the same transcript as `<mango-av-transcript>`, and the two share one load. WebVTT voice tags (`<v Ana>`) give each line its speaker.

```html
<mango-av-player>
  <mango-av-captions slot="stage"></mango-av-captions>
</mango-av-player>
```

| Attribute | Purpose |
| --- | --- |
| `line` | Show only the line being spoken. |
| `audio-only` | Hide while a video plays, since video has captions of its own. |

It can sit anywhere a controller reaches, not only in a player. Inside the `stage` slot over video it takes white text on a dark band. Elsewhere it follows the theme, and `--mango-av-captions-color`, `--mango-av-captions-background`, `--mango-av-captions-size` and `--mango-av-captions-padding` restyle it. It's a labelled `Captions` region, but it doesn't announce each line as it changes; screen reader users can follow the transcript instead.

### CSS custom properties

| Property | Default |
| --- | --- |
| `--mango-av-accent` | `#5b3fd6` |
| `--mango-av-accent-contrast` | `#fff` |
| `--mango-av-accent-tint` | the accent at 12%, behind the row being heard |
| `--mango-av-background` | `#fff` |
| `--mango-av-surface` | `#f4f4f6`, for the tab well, inputs and row hover |
| `--mango-av-text` | `#18181b` |
| `--mango-av-muted` | `#62626a` |
| `--mango-av-border` | `#d7d7de` |
| `--mango-av-danger` | `#b42318` |
| `--mango-av-radius` | `10px` |
| `--mango-av-font` | system sans-serif |
| `--mango-av-list-height` | `24rem`, the most a panel's list grows before it scrolls |
| `--mango-av-panel-background`, `--mango-av-panel-border`, `--mango-av-panel-padding` | The card around a standalone panel; `<mango-av-media>` sets them to nothing |
| `--mango-av-player-aspect-ratio` | The Canvas or source width and height, else `16 / 9` |

A theme set on `<mango-av-media>` reaches the player and panels inside it.

The player controls wear Video.js's default skin: a solid bar along the bottom of the video, or on its own for audio, with the progress bar between the buttons. RAMP's stylesheet is loaded into the player's shadow root, but its overlay theme, `vjs-theme-ramp`, is taken off once the player is ready, and RAMP's own controls are seated in the default bar. In a narrow player, volume and picture in picture are dropped at 480px wide or less, and the skip buttons and playback rate at 360px or less.

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
  };
  audioArt?: {
    title?: string;
    captions?: false | 'line' | 'context';
  };
  resume?: {
    enabled?: boolean;
    maxItems?: number;
    ttlDays?: number;
  };
  strings?: Partial<AVStrings>;
  preferredLanguages?: string[];
  autoAdvance?: boolean;
  repeat?: boolean;
  startCanvasId?: string;
  startTime?: number;
  activePanel?: 'chapters' | 'transcript' | 'annotations' | 'metadata' | 'files' | 'none';
  withCredentials?: boolean;
  playbackRates?: number[];
  fetch?: typeof globalThis.fetch;
  requestInit?: RequestInit;
  resolveRequest?: (url, context) => string | Promise<string>;
  annotationAdapter?: AVAnnotationAdapter;
}
```

`audioArt.title` sets the heading of the audio card. It defaults to `''`, which shows the Manifest label.

`audioArt.captions` shows the transcript in the audio card of `<mango-av-media>`, as captions are on video: `'context'` with the lines either side, `'line'` with only the line being spoken. It defaults to `false`. The captions step aside while a video Canvas plays.

`resume` turns on RAMP's playback position cache. RAMP saves the position as playback goes and, when a saved position is found, offers to resume from it.

`controls.navigation` shows the Previous and Next buttons, while `controls.autoAdvance` shows the Auto-advance checkbox. Both default to `false`; hiding them does not disable `controller.previous()`, `controller.next()`, or programmatic auto-advance.

`withCredentials` is passed to RAMP, which marks each source to be fetched with credentials. That covers the requests Video.js makes itself, such as HLS playlists and segments. Progressive files such as MP4 and MP3 are loaded by the browser's media element, which this does not change. It defaults to `false`.

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
- `resolvedSourceUrl`
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

## Parsing helpers

`normalizeManifest(input, options)` is the version boundary. It returns the same `AVManifest` model for IIIF Presentation 2 and 3.

`parseTimedText`, `parseTranscript`, and `loadTranscript` support WebVTT, SRT, plain text, and structured JSON. `parseTime`, `parseTemporalFragment`, and `formatTime` are also public.
