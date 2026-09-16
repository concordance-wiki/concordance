# The server for agent harnesses

`concordance mcp` serves the questions of [`concordance query`](querying.md) to an agent over its standard input, as tools of the model context protocol: one message per line in, one per line out, nothing else on the standard output. It keeps no state, holds no key, opens no network connection: every tool is a call of `query`, and the answer is the text a person reads at the terminal, or the same JSON when the call asks for it. What `query` cannot do, the server cannot either.

## Starting it

The server reads the model `query` would read: the file `--model` names, else the output of `concordance.yaml` in the working directory or of `--config`, else the published model `concordance-lint.yaml` names for the linter. A harness starts it from the configuration it reads; [`distribution/mcp/mcp.json`](../../distribution/mcp/mcp.json) is the one to copy, pinned to a version of the command line:

```json
{
  "mcpServers": {
    "concordance": {
      "command": "npx",
      "args": ["--yes", "@concordance-wiki/cli@<version>", "mcp", "--model", "./dist/model.json"]
    }
  }
}
```

The working directory of the server is the one the harness starts it in; `--model` is resolved against it. Every call reads the model again, so that a rebuild is seen at the next call without restarting the server.

## The tools

One tool per family of questions, never one per question; each argument is an option of `query`, and every tool takes `format` (`text` by default, `json` for a program) and `limit`.

| Tool | What it answers | Arguments |
|---|---|---|
| `lookup` | The note an expression names, where it is used, what it is linked to, the decisions and sessions among those links | `expression` (required), `sections` (`occurrences`, `links`, `related`), `direction`, `relation`, `context` |
| `search` | The search of the site, ranked and facetted | `words` (required), `type`, `domain`, `application`, `source`, `keywords` (`only` or `exclude`) |
| `relations` | What lies near, why two notes are linked, the way from one to another | `expression` and `mode` (required, `near`, `explain` or `path`), `target`, `radius`, `max_depth`, `context` |
| `list` | The entities of the model, filtered | `type`, `domain`, `application`, `source`, `status`, `all` |
| `corpus` | The counts, the spaces, the domains, what nobody defined, what changed, the findings | `question` (required: `stats`, `sources`, `domains`, `undefined`, `recent`, `changed_with`, `findings`), `expression`, `min_files`, `since`, `source`, `check` |
| `passages` | Where a phrase is written or spoken | `phrase` (required), `source` |

A call the command refuses, an option that does not go with another for instance, comes back with `isError` and the refusal as its text; an answer that found nothing is an answer, not an error. The server answers `initialize` with the version of the protocol it speaks and the version of the command line, `ping`, `tools/list` and `tools/call`; any other method is refused as not found, a line that is not JSON as a parse error, a message without an identifier as a notification that gets no answer.

## What it is not

Not a service: it runs where the harness runs, over one model, for one agent, and stops with its input. Not a way to write: no tool changes a note, a configuration or the model. Not a substitute for the command line: an agent that runs commands reads the same answers with `concordance query`, which needs no configuration of the harness; the server exists for the harnesses that only speak the protocol.
