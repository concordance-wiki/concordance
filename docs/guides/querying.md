# Reading the model from the command line

Your team writes markdown for the assistants; the assistants read it with `grep`. A grep finds the string it was given: it misses the alias and the plural, it does not know that a file is a rule and another a decision, it cannot see the links nobody wrote, and it loads twenty files into a context to answer "where is this term used". The build already knows all of that: `model.json` holds every entity with its type, domain and aliases, every link with its provenance, the neighbourhoods and the recurring expressions nobody defined. `concordance query` reads it, without the site and without a source, and answers in a compact text made to be read by a person at a terminal or put in the context of an agent.

## The problem it solves

```
$ grep -ri "keyword page" . | wc -l
212
$ concordance query "keyword page" --limit 3 --context 1
model dist/model.json (built 2026-09-14T22:36:44.033Z, 2 h ago; sources briefs, glossary, specs)

glossary/inference/recognition/keyword — Keyword [term · domain inference/recognition]
aliases: noteless word, word without a note
file: glossary/inference/recognition/keyword.md:1
A word or expression the discovery kept because it recurs in the corpus without a note defining it…

used in 26 notes, 36 occurrences
  briefs/framing/2026/2026-05-07-roadmap-outline/roadmap-outline — Roadmap outline [document]
    framing/2026/2026-05-07-roadmap-outline/roadmap-outline.md:12  …every recurring expression a keyword page, every doubt a finding…
  … 25 more notes

linked to 148 entities
  ← glossary/inference/links/accompanying-word — Accompanying word [term] specializes 1.00 (cooccurrence, explicit_link, glossary_occurrence)
  … 147 more

decisions and sessions: 6
  ← specs/decisions/publication/one-familiar-chrome — One familiar chrome [decision] affects 0.70 (section_mention)
```

Two hundred grep lines against one answer of a thousand tokens that names the note, its aliases, where it is used with file and line, what it is linked to and how sure the model is, and the decisions that touched it. Every fact comes with its place, so that the reader, human or not, can open the file.

## The model it reads

The command finds its model in this order and says which in its first line: the file `--model` names, anywhere, so that a checkout without a wiki of its own can ask the wiki that covers it (`concordance query --model ../wiki/dist/model.json term`); the output directory of `concordance.yaml` in the current directory, or of `--config`; the published model that `concordance-lint.yaml` names under `global.model` for the linter, read the way `lint --scope global` reads it, cache included. The first line also gives the instant of the build and its age: the model is a build artefact, and the answer is as fresh as the last build. Nothing is fetched, computed or written beyond that; a stale model is reported, not refreshed.

## One verb, options for what is read

`query <expression>` resolves the expression the way the recognition reads a note: an identifier, a title or an alias as written, the same without case, accents or inflections, then a prefix; when several notes answer, a term wins, since the glossary defines the vocabulary, and otherwise the candidates are listed so that nothing is guessed. The [command line guide](command-line.md#query) gives the grammar in full; in short:

| Question | Options |
|---|---|
| The note, where it is used, what it is linked to | `<expression>`, or one section alone with `--occurrences`, `--links`, `--related` |
| The links read one way, or of one relation | `--direction in\|out`, `--relation <slug>` |
| What lies within a few links | `--near --radius n` |
| Why two notes are linked | `--explain <target>` |
| The way from one note to another | `--path <target> --max-depth n` |
| The search of the site, ranked and facetted | `--search <words>` with `--type`, `--domain`, `--application`, `--source`, `--keywords-only`, `--no-keywords` |
| The entities, filtered | `--list` with the same filters and `--status`, `--all` |
| The counts, the spaces, the domains | `--stats`, `--sources`, `--domains` |
| What nobody defined, and where | `--undefined [<expression>] --min-files n` |
| What changed, and with what | `--recent --since day --source s`, `<expression> --changed-with` |
| What the build recorded about a note or under a check | `--findings [<expression>] --check id` |
| Where a phrase is written or spoken | `--text <phrase>` |
| The same as data | `--format json`, the answer about an entity under the [query answer schema](../reference/query.md) |

Every list is bounded (`--limit`, `--context`) and the rest is counted, never cut in silence. `--no-age` leaves the age out of the first line, which makes two answers on one model identical to the byte; it is the only part of an answer that depends on the clock.

## Giving it to an agent

Adoption is a matter of the harness: an agent uses the command when it has been told to. A line in the instructions of a repository is enough, for instance:

> Before answering a question about a term of the business, or before editing a note, run `concordance query "<term>"` from the repository (the wiki that covers it is in `concordance-lint.yaml`) and read the answer; run `concordance query --text "<phrase>"` to find where a phrase is written or spoken.

The text answer is a contract: its wording and its order change with a minor version before 1.0 and a major one after, and the answers to the questions below are recorded and tested on every change.

## What an agent asks

Each question is answered by one invocation. The answers are recorded under [`fixtures/corpora/realistic/en/expected/query/`](../../fixtures/corpora/realistic/en/expected/query/) and compared to the byte by the tests; `pnpm query-fixtures:update` regenerates them, this table included.

<!-- questions:start -->
| An agent asks | It runs |
|---|---|
| What is a keyword page, and where is it used? | `concordance query "keyword page"` |
| Which note is called "word page"? | `concordance query "word page"` |
| Find the note for "Keyword Pages", whatever its exact title. | `concordance query "Keyword Pages"` |
| What answers to "threshold" — one note or several? | `concordance query threshold` |
| Is there anything under "quantum"? | `concordance query quantum` |
| Where exactly is the keyword page named, file and line? | `concordance query glossary/keyword-page --occurrences --limit 5 --context 2` |
| What points at the keyword page? | `concordance query glossary/keyword-page --direction in --limit 5` |
| Which decisions and sessions touch the keyword page? | `concordance query glossary/keyword-page --related` |
| What lies within two links of the keyword page? | `concordance query glossary/keyword-page --near --radius 2 --limit 8` |
| Why are the keyword page and the entity linked? | `concordance query glossary/keyword-page --explain glossary/entity --context 1` |
| How does one get from the keyword page to the decision that applied the threshold in the model? | `concordance query glossary/keyword-page --path "Threshold applied in model"` |
| Which pages talk about the publication threshold, best first? | `concordance query --search "publication threshold" --limit 5` |
| Which recurring expressions without a note mention the build? | `concordance query --search build --keywords-only --limit 5` |
| List every decision of the wiki. | `concordance query --list --type decision` |
| What does the meetings space hold? | `concordance query --list --source meetings` |
| How big is this wiki, and of what? | `concordance query --stats` |
| Which spaces make up the wiki, and when did each last move? | `concordance query --sources` |
| Which domains file the notes? | `concordance query --domains` |
| Which expressions recur in at least three files without a note? | `concordance query --undefined --min-files 3 --limit 5` |
| Where is "build summary" written, given that no note defines it? | `concordance query --undefined "build summary" --limit 3` |
| What changed most recently, in the meetings? | `concordance query --recent --source meetings --limit 3` |
| What changed together with the threshold review? | `concordance query "Keyword page threshold review" --changed-with` |
| Which findings did the build record under W-TERM-UNDEFINED? | `concordance query --findings --check W-TERM-UNDEFINED --limit 3` |
| Where is "build summary" written or spoken, sections and documents alike? | `concordance query --text "build summary" --limit 4` |
| The same answer as data, for a program. | `concordance query glossary/keyword-page --format json --limit 2 --context 1` |
<!-- questions:end -->

A question that would need two invocations is a defect of the grammar to report, not a note to add here.
