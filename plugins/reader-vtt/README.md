<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/brand/concordance-mark.svg" width="72" alt="Concordance">
</p>

<h1 align="center">@concordance-wiki/plugin-reader-vtt</h1>

<p align="center"><strong>Reads meeting transcripts and subtitles, so what was said can be searched and cited by timecode.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concordance-wiki/plugin-reader-vtt"><img alt="npm" src="https://img.shields.io/npm/v/@concordance-wiki/plugin-reader-vtt?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/blob/main/LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0--or--later-16181B?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/concordance-wiki/concordance/ci.yml?branch=main&label=ci&style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md">Getting started</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md">Configuration</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/publishing-transcripts.md">Publishing transcripts</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/plugins/reader-vtt/CHANGELOG.md">Changelog</a>
</p>

---

## Why

The transcript of a meeting is where a decision was actually taken, and nobody replays the recording to find the minute. This plugin reads WebVTT (`.vtt`) and SubRip (`.srt`) files in your repositories and makes each of them a page of the wiki: the speakers, the duration and the language as properties, the text cut into one addressable unit per speaker turn, so that a mention of a term in it cites `00:12:05` where a note cites a line. Transcripts stay out of the published site until the configuration says otherwise, pseudonymised or not. It is carried by [`@concordance-wiki/concordance`](https://www.npmjs.com/package/@concordance-wiki/concordance); install it on its own next to [`@concordance-wiki/cli`](https://www.npmjs.com/package/@concordance-wiki/cli). No system dependency.

## Quick start

```bash
npm install --save-dev @concordance-wiki/plugin-reader-vtt
```

Then declare it in `concordance.yaml`:

```yaml
plugins:
  - "@concordance-wiki/plugin-reader-vtt"
```

Every `.vtt` and `.srt` file of a source becomes a transcript entity. To publish the transcripts, and the names in them, say so:

```yaml
privacy:
  publish_transcripts: true
  pseudonymize:
    enabled: true
    dictionary: ./pseudonyms.yaml
```

The transcript as a library, without the build:

```ts
import { parseTranscript, renderTranscript, transcriptUnits } from "@concordance-wiki/plugin-reader-vtt";

const transcript = parseTranscript("WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n<v Reviewer>The occurrence scan reads every note.\n", "vtt");
transcript.speakers; // ["Reviewer"]
transcriptUnits(transcript).map((unit) => unit.label); // ["00:00:01"]
renderTranscript(transcript); // one <article> per speaker turn, one <p id="t-1000"> per cue
```

## What you get

- **A page per transcript**: speakers, duration and language as properties, the text readable turn by turn.
- **Citations by timecode**: every mention of a term in a transcript points at the cue where it was said, with a shareable anchor.
- **Private by default**: a transcript is read but never published, pseudonymised or not, until `privacy.publish_transcripts` lets it into the site and its search index.
- **Pseudonymisation at build**: `rewriteTranscript` writes the file again with every speaker and every text passed through your dictionary, so the file offered for download never carries a real name.
- **Two formats, one parser**: `parseTranscript` reads WebVTT and SubRip into cues, speakers in order of first appearance, duration and the `Language:` header; `writeTranscript` writes either back.
- **Static HTML**: `renderTranscript`, one `<article>` per speaker turn, one paragraph per cue, no script needed.

## Documentation

- [Publishing transcripts](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/publishing-transcripts.md): what to settle before the first build that publishes one
- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md), the `privacy` block
- [Plugins](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md), the reader contribution point
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/plugins/reader-vtt/CHANGELOG.md)

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.

<details>
<summary>Inside the package</summary>

The plugin contributes a `reader` for `.vtt` and `.srt`. `parseTranscript(text, format)` turns a transcript into its cues (index, start and end in seconds, speaker, text), the unique speakers in order of first appearance, the duration (end of the last cue) and, for VTT, the `Language:` header. `renderTranscript` produces static HTML: one `<article>` per run of consecutive cues of the same speaker, headed by the speaker's name, and one `<p id="t-<milliseconds>">` per cue whose timecode links to its own anchor, so that a timecode is shareable as a URL fragment; a second cue starting at the same instant takes its rank as a suffix (`t-12000-2`), so that every cue stays addressable. `transcriptText` gives the spoken text, one line per speaker turn, with the character range of every cue, so that a position in the text maps back to a timecode. The reader returns `{ metadata: { format, language, duration, cues, speakers }, text, units }`, where `units` (`transcriptUnits`) cuts the text into one addressable unit per speaker turn, `{ label, text, anchor, speaker? }`, labelled by the timecode of its first cue, named after its speaker when the cues name one and anchored like the rendering; the build reads them as the positions of the transcript, so that its text goes through term recognition like any other content and a mention in it cites `00:12:05` where a note cites a line. `rewriteTranscript` writes the file again with every speaker and every text passed through the substitution the pseudonymisation gives, timecodes kept, so that the file offered for download never carries a real name.

### Parsing rules

| Rule | VTT | SRT |
|---|---|---|
| header | `WEBVTT` required, optional `Key: value` lines below it; `Language:` is kept | none |
| cue identifier | optional line before the timing | the cue number |
| timing | `hh:mm:ss.mmm --> hh:mm:ss.mmm` or `mm:ss.mmm`, cue settings after the end ignored | `hh:mm:ss,mmm --> hh:mm:ss,mmm` |
| speaker | `<v Name>text</v>` or `<v Name>text`; without a voice span, a `Name: ` prefix | a `Name: ` prefix: one to four words each starting with a capital or a digit (`ALICE`, `Bob Martin`, `Speaker 1`) |
| markup | `<b>`, `<i>`, `<c.class>`, inline timestamps and any other tag stripped; `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&nbsp;` decoded | same |
| comments | `NOTE`, `STYLE` and `REGION` blocks skipped | none |
| line endings | LF or CRLF; a leading byte order mark is ignored | same |

A malformed timing line throws an `Error` naming its line number; a VTT file without `WEBVTT` header throws `line 1: missing WEBVTT header`. The lines of a multi-line cue are joined with a space.

### Privacy

Speaker names are returned as they appear by the reader: pseudonymisation is a separate step of the build, `privacy.pseudonymize`, that runs before anything of a transcript is rendered, indexed or offered for download, and `privacy.publish_transcripts` is what lets a transcript into the published site at all. A passage from which a decision note was extracted will carry a reference to that note; the cue anchors are what such a reference points at.

</details>
