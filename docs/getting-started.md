# Getting started

AT Package Manager is a distributed, public package manager built on the [AT Protocol](https://atproto.com/) with a passthrough to the public NPM registry. The only requirement to consume from ATPM is to point your package manager at [https://atpm.dev](https://atpm.dev).

This is usually done by creating a `.npmrc` file in the root of your project.

```sh
registry=https://atpm.dev
```

## Publishing packages

Using the NPM CLI we can login, stage, and approve new package versions.

Run the login command and complete the authentication flow in the browser.

```sh
npm login
```

Stage a new package version.

```sh
npm stage publish
```

List your staged versions.

```sh
npm stage list
```

Approve the new version for publication.

```sh
npm stage approve <id>
```

### Trusted publishing

ATPM supports trusted publishing and OIDC credentials via GitHub workflows. See the [trusted publishing guide](/docs/trusted-publishing) for more information.
