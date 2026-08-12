# Trusted publishing

AT Package Manager supports trusted publishing and OIDC credentials via GitHub workflows.

## Initial setup

Begin by creating a trusted publisher for your github repository and workflow at [https://atpm.dev/dash/publishers](https://atpm.dev/dash/publishers).

This creates a public record in your PDS for auditability and allows for no token management in the workflow.

## The workflow

After configuring the trusted publisher, our github action is super simple and does not require any CI tokens.

```yaml
name: Publish
on:
  push:
    tags:
      - "v*"
permissions:
  id-token: write
  contents: read
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: "24"
      - run: npm stage publish
```
