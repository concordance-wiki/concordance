# W-PLUGIN-DISABLED

**Severity:** warning. **Family:** plugins.

A declared plugin needs a system tool that is not installed, so the plugin was not registered and the build went on without its contributions.

A plugin declares its system dependencies in its manifest, each with the command that detects it. Before registering the plugin, the build runs `<command> --version` for every declared dependency. A required dependency that is missing disables the whole plugin: none of its readers, converters, sources, inference methods, checks, projections or UI components takes part in the build. An `optional` dependency that is missing yields the same finding with severity `info`, and the plugin stays registered.

## Before

```
plugins:
  - "@concordance-wiki/plugin-convert-libreoffice"   (soffice is not installed on the build machine)
```

```
warning: W-PLUGIN-DISABLED: plugin @concordance-wiki/plugin-convert-libreoffice is disabled: its system dependency LibreOffice is missing, command soffice is not available
```

## After

```
plugins:
  - "@concordance-wiki/plugin-convert-libreoffice"   (soffice answers --version)
```

## How to fix

Install the tool on the machine or in the image that runs the build, so that the command is on the `PATH`, or remove the plugin from `plugins:` when its contributions are not wanted there. Raise the severity to `error` under `checks:` when a missing tool must fail the build.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
