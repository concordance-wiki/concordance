# @concordance-wiki/plugin-reader-vtt

Reader for meeting transcripts and subtitles in WebVTT (`.vtt`) and SubRip (`.srt`), so that what was said can be read, searched and cited without replaying the recording.

Today: the plugin contributes a `reader` for `.vtt` and `.srt`. `parseTranscript(text, format)` turns a transcript into its cues (index, start and end in seconds, speaker, text), the unique speakers in order of first appearance, the duration (end of the last cue) and, for VTT, the `Language:` header. `renderTranscript` produces static HTML: one `<article>` per run of consecutive cues of the same speaker, headed by the speaker's name, and one `<p id="t-<milliseconds>">` per cue whose timecode links to its own anchor, so that a timecode is shareable as a URL fragment. `transcriptText` gives the spoken text, one line per speaker turn, with the character range of every cue, so that a position in the text maps back to a timecode. The reader returns `{ metadata: { format, language, duration, cues, speakers }, text }`; the text goes through term recognition like any other content once the pipeline consumes readers.

## Parsing rules

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

## Later

Speaker names are returned as they appear: pseudonymisation is a separate step that runs before anything is published or indexed. A passage from which a decision note was extracted will carry a reference to that note; the cue anchors are what such a reference points at.

Part of [Concordance](../../README.md).
