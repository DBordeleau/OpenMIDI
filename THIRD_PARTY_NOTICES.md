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

## DiceBear core

OpenMIDI uses `@dicebear/core` 10.3.0.

MIT License

Copyright (c) 2026 Florian Körner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Adventurer Neutral avatar artwork

OpenMIDI uses the Adventurer Neutral definition distributed by
`@dicebear/styles` 10.2.0. Adventurer Neutral is by
[Lisa Wischofsky](https://www.instagram.com/lischi_art/) and is licensed under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
The [original source](https://www.figma.com/community/file/1184595184137881796)
is identified in the bundled DiceBear style metadata. OpenMIDI renders the
bundled definition locally and does not request avatars from DiceBear.
