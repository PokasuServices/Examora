# Changesets

This directory is managed by [Changesets](https://github.com/changesets/changesets). Run
`pnpm changeset` after making a change to a shared package (`packages/*` or `database`) that
should be reflected in its changelog/version. Apps (`apps/web`, `apps/api`, `apps/admin`) are
excluded from versioning — see `.changeset/config.json`.
