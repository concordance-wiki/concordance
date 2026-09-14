# @concordance-wiki/plugin-reader-vtt

A reader plugin for Concordance that reads meeting transcripts and subtitles in WebVTT (`.vtt`) and SubRip (`.srt`), so that what was said can be read, searched and cited by timecode without replaying the recording. An integrator installs it with `@concordance-wiki/concordance`, which carries it, or next to `@concordance-wiki/cli`, and declares it in `concordance.yaml`; no system dependency.

## Install

```bash
npm install --save-dev @concordance-wiki/plugin-reader-vtt
```

Then declare it in `concordance.yaml`:

```yaml
plugins:
  - "@concordance-wiki/plugin-reader-vtt"
```

## Use

With the plugin declared, every `.vtt` and `.srt` file of a source becomes a transcript entity: its speakers, duration and language as properties, its text cut into one addressable unit per speaker turn, so that a mention of a term in it cites `00:12:05` where a note cites a line. Transcripts stay out of the published site and its search index until the configuration says otherwise, pseudonymised or not:

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

## What it contains

- The plugin manifest, as the default export: one `reader` contribution for `.vtt` and `.srt`.
- `readTranscript`, `rewriteTranscript`: the reader, `{ metadata, text, units }`, and the file written again with every speaker and text substituted, for pseudonymisation.
- `parseTranscript`: cues (index, start and end in seconds, speaker, text), speakers in order of first appearance, duration and the `Language:` header.
- `transcriptText`, `transcriptUnits`: the spoken text, one line per speaker turn with the character range of every cue, and the addressable units the build reads as positions.
- `renderTranscript`, `groupCues`, `formatTimecode`, `anchorOf`, `escapeHtml`: the static HTML with a shareable anchor per cue.
- `writeTranscript`, `formatTiming`: a transcript written back in its format.

## Documentation

- [Publishing transcripts](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/publishing-transcripts.md): what to settle before the first build that publishes one
- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md), the `privacy` block
- [Plugins](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md), the reader contribution point
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/plugins/reader-vtt/CHANGELOG.md)

## Inside

The plugin contributes a `reader` for `.vtt` and `.srt`. `parseTranscript(text, format)` turns a transcript into its cues (index, start and end in seconds, speaker, text), the unique speakers in order of first appearance, the duration (end of the last cue) and, for VTT, the `Language:` header. `renderTranscript` produces static HTML: one `<article>` per run of consecutive cues of the same speaker, headed by the speaker's name, and one `<p id="t-<milliseconds>">` per cue whose timecode links to its own anchor, so that a timecode is shareable as a URL fragment. `transcriptText` gives the spoken text, one line per speaker turn, with the character range of every cue, so that a position in the text maps back to a timecode. The reader returns `{ metadata: { format, language, duration, cues, speakers }, text, units }`, where `units` (`transcriptUnits`) cuts the text into one addressable unit per speaker turn, `{ label, text, anchor, speaker? }`, labelled by the timecode of its first cue, named after its speaker when the cues name one and anchored like the rendering; the build reads them as the positions of the transcript, so that its text goes through term recognition like any other content and a mention in it cites `00:12:05` where a note cites a line. `rewriteTranscript` writes the file again with every speaker and every text passed through the substitution the pseudonymisation gives, timecodes kept, so that the file offered for download never carries a real name.

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

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.
