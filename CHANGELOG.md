# Changelog

## 1.0.1

- Fixed transcript lines being listed as annotations. A `supplementing` or `transcribing` item with an inline textual body becomes a transcript cue and is no longer also added to `canvas.annotations`, in embedded Annotation Pages and in those fetched by reference. Items with other motivations, and transcripts referenced by `id` such as WebVTT, are unchanged.
- A configuration change no longer recreates the player or interrupts playback. `<mango-av-media>` keeps its `<mango-av-player>` and rebuilds only its captions and tabs, and the player refreshes its audio card and toolbar around RAMP. RAMP is still remounted when a setting it is mounted with changes: `preferredLanguages`, `playbackRates`, `withCredentials`, `resume`, `resolveRequest`, or the `captions`, `download`, `playbackRate`, `pictureInPicture`, `seek` and `skipSeconds` controls.

## 1.0.0

### Playback through Samvera RAMP

- `<mango-av-player>`, and the player in `<mango-av-media>`, now play through [Samvera RAMP](https://github.com/samvera-labs/ramp) 5.1.1 in place of Media Chrome. RAMP gets a Presentation 3 Manifest holding only the active Canvas and source, rebuilt from the normalized model, so Presentation 2 Manifests, `resolveRequest`, source selection and Canvas navigation keep working through the controller. The controller attaches to RAMP's media element, so its API and events are unchanged.
- React, RAMP and Video.js are new dependencies, loaded with a dynamic import the first time a player renders. `media-chrome` and `hls-video-element` are removed; RAMP's Video.js plays HLS.
- The player controls wear Video.js's default skin, a solid bar under the picture, in place of RAMP's overlay theme. The skip buttons use a circular-arrow icon matching the other controls.
- Player controls map onto RAMP: play, progress, time, volume, captions, playback rate, picture in picture, download and fullscreen, plus skip buttons from `controls.skipSeconds` (rounded to 5, 10 or 30 seconds). Previous, Next, Auto-advance and the source selector stay in the toolbar under the player.
- `<mango-av-media>` takes the layout and styling from the Mango annotation editor's audio and video view. The player comes first, then a `Position 0:12 / 3:45` line, then segmented tabs for Transcript, Chapters, Annotations, Metadata and Files. Its tabs are the standalone panel elements sharing its controller, and `activePanel` now defaults to `'transcript'`.
- Transcript, chapters and annotations are rows of a time column and text, with the passage being heard tinted. While playing, the transcript keeps the current cue at the top of its list. Chapters now highlight the chapter being heard rather than every chapter on the Canvas.
- Audio shows a card with the Canvas poster or Manifest thumbnail, a `Recording` eyebrow, and `audioArt.title`, which now defaults to the Manifest label.
- New theme properties: `--mango-av-accent-tint`, `--mango-av-danger`, `--mango-av-list-height`, and `--mango-av-panel-background`, `--mango-av-panel-border` and `--mango-av-panel-padding` for the standalone panel card. A theme set on `<mango-av-media>` now reaches the components inside it.
- `AVManifest.thumbnail` is normalized from the Manifest `thumbnail`.

### Audio captions

- New `<mango-av-captions>` element, also at `@mango-iiif/av/captions`, which shows the transcript's line being spoken as captions are shown on video, with the lines either side faded (or only the current line with `line`).
- `<mango-av-player>` has a `stage` slot for content shown with the media: in the audio card above the controls, or over the foot of a video.
- `audioArt.captions` (`'context'`, `'line'` or `false`) shows captions in the audio card of `<mango-av-media>`.
- WebVTT voice tags (`<v Ana>`) now set each cue's speaker.
- The transcript panel and captions share one load of a transcript.
- A new demo page, `captions.html`, shows captions built in and in a layout of the page's own.
- Fixed the line being heard losing its highlight while the pointer is over it.

### Breaking changes

- Removed the audio artwork visualizer and moving transcript (`audioArt.visualizer`, `audioArt.transcript`, `--mango-av-visualizer-color`, `--mango-av-visualizer-intensity`) and the `av-visualizerfallback` event. They needed to own the media element, which RAMP now does.
- Removed `crossorigin` and `preload`. `withCredentials` sends credentials with the requests Video.js makes itself, such as HLS segments; RAMP gives no way to set the media element's own `crossorigin` attribute.
- Resume uses RAMP's position cache and prompt. Removed `resume.prompt`, `controller.getSavedPosition()`, and the `resumePrompt`, `resume` and `startOver` strings.
- Removed transcript search markers (`transcript.showSearchMarkers`) and the `transcriptSearchMatches`, `searchMatchAt`, `downloadMediaFile` and `unableToLoadMedia` strings. Added the `position` and `recording` strings; `searchTranscript` now reads `Find in transcript`.
- Removed `--mango-av-panel-width`, and the Media Chrome `player-overlay` and `controls` slots of `<mango-av-media>` and `overlay` and `controls` slots of `<mango-av-player>`.
- `controller.selectCanvas()`, `next()`, `previous()` and `selectSource()` now detach the current media element. Playback that was running resumes once the next media element can play.

### Earlier unreleased changes

- Added `--mango-av-visualizer-color` and `--mango-av-visualizer-intensity` so the audio artwork visualizer can carry a colour and a strength of its own instead of only following `--mango-av-accent`. Intensity applies to all three modes, scaling the pulse tint, the waveform trace and the spectrum bars in size as well as opacity, and each mode keeps its existing ceiling. Both properties are read at the point of use, so a value set on the custom element inherits through to the artwork, and both default to the existing appearance.
- The configuration builder demo gained visualizer colour and intensity controls alongside the visualizer mode select.

- Fixed `<mango-av-player>` failing to resolve and attach media when given an already-loaded `AVPlayerController`.
- Audio artwork no longer displays the Canvas label as a visible title by default. Hosts can opt in to custom text with `audioArt.title`.
- Fixed a cross-origin audio regression where enabling audio artwork visualization could route otherwise playable media through a CORS-unsafe Web Audio graph and produce silence. Visualizer loads now establish their CORS policy before assigning the source URL and automatically fall back once to ordinary HTML audio for servers without CORS support.
