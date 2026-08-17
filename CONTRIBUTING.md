# Contributing

## Branches

- `main` is the stable, releasable version of the real project.
- `develop` is the only working branch. All features, fixes, tests, and documentation changes are committed there.
- Do not commit directly to `main` and do not create additional branches for normal work.
- When `develop` is tested and ready, open a pull request from `develop` into `main`.

Start each work session on `develop`:

```bash
git switch develop
git status
```

After changing files, run the checks and commit to `develop`:

```bash
npm run check
git add <changed-files>
git commit -m "feat: describe the change"
```

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

1. Finish and commit the intended release changes on `develop`.
2. Run `npm ci` after dependency changes.
3. Run `npm run check`.
4. Open a pull request from `develop` into `main`.
5. Describe the user-visible effect, implementation, tests, and any data migration.
6. Merge only after CI passes; prefer a regular merge so `develop` and `main` can be synchronized without rewriting `develop` history.
7. After merging, update local branches with `git pull --ff-only` where possible.

## Versioning and releases

This pre-1.0 project uses Semantic Versioning:

- Patch (`0.9.1`): compatible bug or security fix.
- Minor (`0.10.0`): new functionality or a meaningful pre-1.0 behavior change.
- Major (`1.0.0`): first stable release; later major bumps contain breaking changes.

Release procedure:

1. Move relevant entries from `Unreleased` in `CHANGELOG.md` into a dated version section.
2. Run `npm version <patch|minor|major> --no-git-tag-version`.
3. Run `npm run check` on `develop` and merge the `develop` → `main` release pull request.
4. On `main`, create an annotated tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
5. Push the commit and tag: `git push origin main --follow-tags`.
6. Synchronize `develop` from the released `main` if the merge created a new commit.
7. Create a GitHub release from the changelog section.

Do not rewrite or tag historical commits merely to clean up old commit messages. Apply these conventions to new work.
