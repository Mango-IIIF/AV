# Changelog

## Unreleased

- Added `--mango-av-visualizer-color` and `--mango-av-visualizer-intensity` so the audio artwork visualizer can carry a colour and a strength of its own instead of only following `--mango-av-accent`. Intensity applies to all three modes, scaling the pulse tint, the waveform trace and the spectrum bars in size as well as opacity, and each mode keeps its existing ceiling. Both properties are read at the point of use, so a value set on the custom element inherits through to the artwork, and both default to the existing appearance.
- The configuration builder demo gained visualizer colour and intensity controls alongside the visualizer mode select.

- Fixed `<mango-av-player>` failing to resolve and attach media when given an already-loaded `AVPlayerController`.
- Audio artwork no longer displays the Canvas label as a visible title by default. Hosts can opt in to custom text with `audioArt.title`.
- Fixed a cross-origin audio regression where enabling audio artwork visualization could route otherwise playable media through a CORS-unsafe Web Audio graph and produce silence. Visualizer loads now establish their CORS policy before assigning the source URL and automatically fall back once to ordinary HTML audio for servers without CORS support.
