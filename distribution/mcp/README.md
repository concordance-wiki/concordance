# The server for agent harnesses

`concordance mcp` serves the questions of `concordance query` to an agent over its standard input, as tools of the model context protocol: one message per line in, one per line out, nothing else on the standard output, no state, no key, no network. Every tool is a call of `query`; the answer is the same text a person reads at the terminal, or the same JSON.

`mcp.json` is the configuration a harness reads to start the server, pinned to a version of the command line: copy it next to the wiki, or point `--model` at the `dist/model.json` of the wiki that covers the repository the agent works in. The [guide](../../docs/guides/mcp.md) lists the tools and their arguments.
