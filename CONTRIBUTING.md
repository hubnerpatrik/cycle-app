# Contributing

## Branches

- `main` is the stable branch and should stay releasable.
- Create short-lived branches from an up-to-date `main`.
- Use names such as `feat/map-export`, `fix/cycle-boundary`, or `docs/versioning`.
- Open a pull request back to `main`; do not develop long-running features directly on `main`.

## Commits

Keep commits focused and use Conventional Commit-style subjects:

```text
feat: add map export
fix: reject malformed stored maps
docs: explain the release process
test: cover year-boundary cycles
chore: update repository tooling
```

Use the imperative mood, keep the subject concise, and explain motivation or migration concerns in the body when needed. Avoid commit messages such as `update`, `changes`, or `final touch-ups`.

## Pull requests

1. Update your branch from `main`.
2. Run `npm ci` after dependency changes.
3. Run `npm run check`.
4. Describe the user-visible effect, implementation, tests, and any data migration.
5. Prefer squash merging so each pull request becomes one clear commit on `main`.

## Versioning and releases

This pre-1.0 project uses Semantic Versioning:

- Patch (`0.9.1`): compatible bug or security fix.
- Minor (`0.10.0`): new functionality or a meaningful pre-1.0 behavior change.
- Major (`1.0.0`): first stable release; later major bumps contain breaking changes.

Release procedure:

1. Move relevant entries from `Unreleased` in `CHANGELOG.md` into a dated version section.
2. Run `npm version <patch|minor|major> --no-git-tag-version`.
3. Run `npm run check` and merge the release pull request.
4. On `main`, create an annotated tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
5. Push the commit and tag: `git push origin main --follow-tags`.
6. Create a GitHub release from the changelog section.

Do not rewrite or tag historical commits merely to clean up old commit messages. Apply these conventions to new work.
