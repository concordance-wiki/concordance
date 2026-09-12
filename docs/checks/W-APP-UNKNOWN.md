# W-APP-UNKNOWN

**Severity:** warning. **Family:** vocabulary and filing.

The resolved application is not declared in the configuration.

The application cascade (the source's `application`, a typing rule's `set.application`, the frontmatter `application`) produced an identifier that `applications:` does not declare. The value is kept as written on the entity, and the finding says where it came from, so the site shows what was meant; nothing composes the entity into a declared application.

## Before

```
sources:
  - name: specs
    git: https://example.invalid/knowledge/specs.git
    application: policy-admn
applications:
  - id: policy-admin
```

## After

```
sources:
  - name: specs
    git: https://example.invalid/knowledge/specs.git
    application: policy-admin
applications:
  - id: policy-admin
```

## How to fix

Declare the application under `applications:` in `concordance.yaml`, or fix the source, the rule or the frontmatter that sets it.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
