# Changelog

## Unreleased

- Audio artwork no longer displays the Canvas label as a visible title by default. Hosts can opt in to custom text with `audioArt.title`.
- Fixed a cross-origin audio regression where enabling audio artwork visualization could route otherwise playable media through a CORS-unsafe Web Audio graph and produce silence. Visualizer loads now establish their CORS policy before assigning the source URL and automatically fall back once to ordinary HTML audio for servers without CORS support.
