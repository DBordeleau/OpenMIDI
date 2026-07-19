# Third-party notices

OpenMIDI's own source remains all rights reserved. Dependencies retain their licenses.

## Waveform Playlist integration

The production browser studio uses these MIT-licensed packages without copying upstream source or demo media:

- `@waveform-playlist/browser` 15.3.4
- `@waveform-playlist/playout` 12.5.4
- `tone` 15.1.22
- `@dnd-kit/react` 0.3.2
- `styled-components` 6.4.3

Waveform Playlist is Copyright (c) Naomi Aro and contributors and is provided under the MIT License. The package distributions in `node_modules` contain their authoritative license text. Tone.js, dnd-kit, and styled-components are also provided under their respective MIT licenses.

## MIDI feasibility and interchange

The standalone MIDI interaction design uses Signal as an MIT-licensed behavioral and implementation reference pinned to commit `632de9685990c90d0be127994908cc43692ff82a` (Copyright (c) 2016 ryohey). OpenMIDI does not bundle Signal, its application state, Firebase integration, player, SoundFonts, or assets. The reviewed interaction vocabulary is translated into OpenMIDI-owned semantic commands and accessible controls. The preserved upstream notice is in [`docs/third-party/signal-LICENSE.txt`](docs/third-party/signal-LICENSE.txt).

Browser-only Standard MIDI File parsing and writing uses the exactly pinned MIT-licensed `@tonejs/midi` 2.0.28 package (Copyright © 2016 Yotam Mann). Its locked transitive parser dependencies, `midi-file` 1.2.4 and `array-flatten` 3.0.0, are also MIT licensed. Package distributions in `node_modules` contain their authoritative license and package metadata.

## Browser lossless audio optimization

The upload-only browser worker uses these exactly pinned packages without modifying their distributed source:

- `mediabunny` 1.50.8
- `@mediabunny/flac-encoder` 1.50.8

Mediabunny and its FLAC encoder extension are Copyright (c) Vanilagy and contributors and are provided under the Mozilla Public License 2.0. Their npm distributions include the complete MPL-2.0 license and corresponding source form. The extension embeds a size-optimized WebAssembly build of Xiph.Org's `libFLAC`; the libFLAC libraries are distributed under the Xiph.Org BSD-like license (`COPYING.Xiph`) in the upstream [xiph/flac source](https://github.com/xiph/flac). OpenMIDI loads this code only through the dedicated browser upload worker and does not copy or modify its source files.
