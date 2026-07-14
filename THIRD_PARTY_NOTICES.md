# Third-party notices

Jam Session's own source remains all rights reserved. Dependencies retain their licenses.

## Waveform Playlist integration

The production browser studio uses these MIT-licensed packages without copying upstream source or demo media:

- `@waveform-playlist/browser` 15.3.4
- `@waveform-playlist/playout` 12.5.4
- `tone` 15.1.22
- `@dnd-kit/react` 0.3.2
- `styled-components` 6.4.3

Waveform Playlist is Copyright (c) Naomi Aro and contributors and is provided under the MIT License. The package distributions in `node_modules` contain their authoritative license text. Tone.js, dnd-kit, and styled-components are also provided under their respective MIT licenses.

## Browser lossless audio optimization

The upload-only browser worker uses these exactly pinned packages without modifying their distributed source:

- `mediabunny` 1.50.8
- `@mediabunny/flac-encoder` 1.50.8

Mediabunny and its FLAC encoder extension are Copyright (c) Vanilagy and contributors and are provided under the Mozilla Public License 2.0. Their npm distributions include the complete MPL-2.0 license and corresponding source form. The extension embeds a size-optimized WebAssembly build of Xiph.Org's `libFLAC`; the libFLAC libraries are distributed under the Xiph.Org BSD-like license (`COPYING.Xiph`) in the upstream [xiph/flac source](https://github.com/xiph/flac). Jam Session loads this code only through the dedicated browser upload worker and does not copy or modify its source files.
