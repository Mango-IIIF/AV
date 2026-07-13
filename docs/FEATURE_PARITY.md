# Feature coverage

This document records the audio, video, IIIF, transcript, annotation, and integration behavior implemented in `@mango-iiif/av`.

| Capability | `@mango-iiif/av` implementation | Verification |
| --- | --- | --- |
| Root IIIF player with URL/object input | `<mango-av-media>` and `AVPlayerController.load` | Unit + browser |
| Video and audio playback | Native media elements inside Media Chrome | Browser |
| HLS | `<hls-video>` with native HLS/hls.js fallback | Browser demo |
| Multiple media resources and quality/source selection | Normalized `Choice`/body list and source selector | Unit |
| Multi-Canvas playback | Previous, next, Canvas selection, state events | Unit + browser |
| Temporal Canvas/source clipping | `#t=` normalization and segment enforcement | Unit |
| Custom start Canvas/time | Presentation 2 `startCanvas`, Presentation 3 `start`, and config overrides | Unit |
| Auto-advance and repeat | Manifest behavior plus runtime toggle/API | Unit/controller |
| Structured navigation | Recursive Presentation 2/3 Range model and accessible chapter buttons | Unit + browser |
| Transcripts | Inline/external transcript resources and synchronized panel | Unit + browser |
| Transcript formats | WebVTT, SRT, text, JSON, and inline TextualBody; DOCX is intentionally excluded | Unit |
| Transcript selector/search/download | Configurable transcript tools | Browser |
| Transcript auto-scroll | Active cue tracking against controller time | Browser |
| Captions/subtitles/descriptions | Native tracks and Media Chrome captions menu | Parser unit + browser |
| Time-synchronized annotations | Commenting, supplementing, transcribing, tagging, and highlighting display | Unit + browser |
| Marker create/edit/delete endpoints | Typed `annotationAdapter` and controller mutation API | Controller API |
| Metadata display | Manifest + Canvas metadata, rights, and required statement | Parser unit + browser |
| Supplemental files | Manifest + Canvas `rendering` downloads | Parser unit + browser |
| Resume playback | Bounded, expiring local-storage cache with optional prompt | Controller/browser |
| IIIF Auth integration | Auth service discovery plus configurable fetch/request resolver | Parser unit/API |
| Poster/placeholder | Presentation 3 `placeholderCanvas` extraction | Parser |
| Responsive layout and accessibility | Responsive panel, native controls, ARIA tabs/navigation, keyboard-native buttons | Playwright |
| Standalone usage | Complete and independently placeable framework-free elements plus controller-only entry point | Build/pack |
| Configurable appearance | CSS properties, named slots, Media Chrome variables, live style recipes | Playwright/demo |

## Deliberate API differences

- React Context and React component props are replaced by a typed controller and DOM events.
- Video.js-specific plugin APIs are replaced by standard `HTMLMediaElement` methods and Media Chrome controls.
- Playlist marker mutations use `annotationAdapter`, allowing REST, GraphQL, local-first, or authenticated persistence.
- Protected-resource policy remains with the consuming application through `fetch`, `requestInit`, and `resolveRequest`; the package does not hard-code a login provider or token transport.
- Styling uses stable host-level custom properties and slots rather than component SCSS overrides.
- DOCX/Word transcript parsing is intentionally out of scope; the loader rejects it explicitly.

## Additional IIIF behavior

The normalized model also preserves Presentation version, Canvas behaviors, audio-description tracks, nested Ranges, required statements, rights, homepages, auth services, source dimensions/duration, and machine-generated transcript flags. Unknown motivations and behaviors are retained as strings so extensions remain available to host applications.
