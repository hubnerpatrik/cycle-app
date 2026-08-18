# Contributing

Cycle Tracker uses a simple two-branch workflow designed to keep active development separate from stable releases.

---

## Branches

| Branch | Purpose |
|---|---|
| `main` | Stable and releasable version of the project |
| `develop` | Active development branch for features, fixes, tests, and documentation |

Normal development happens only on `develop`.

Do not commit directly to `main` and do not create additional branches for routine work.

When `develop` is tested and ready for release, open a pull request:

```text
develop → main
```

### Starting a work session

```bash
git switch develop
git status
```

### Before committing

Run the project checks:

```bash
npm run check
```

Then commit the changed files:

```bash
git add <changed-files>
git commit -m "feat: describe the change"
```

---

## Commits

Keep commits focused and use concise Conventional Commit-style subjects.

```text
feat: add map export
fix: reject malformed stored maps
docs: explain the release process
test: cover year-boundary cycles
chore: update repository tooling
```

### Common prefixes

| Prefix | Use |
|---|---|
| `feat:` | New functionality |
| `fix:` | Bug fix |
| `docs:` | Documentation |
| `test:` | Tests |
| `chore:` | Tooling, maintenance, or repository changes |

Use the imperative mood and keep the subject short and specific.

When necessary, use the commit body to explain motivation, implementation details, or migration concerns.

Avoid vague messages such as:

```text
update
changes
final touch-ups
```

---

## Pull Requests

A release normally follows this flow:

1. Finish the intended changes on `develop`.
2. Commit all relevant files.
3. Run `npm ci` after dependency changes.
4. Run:

```bash
npm run check
```

5. Open a pull request from `develop` into `main`.
6. Describe:
   - user-visible changes,
   - important implementation details,
   - tests performed,
   - any required data migration.
7. Merge only after CI passes.
8. Prefer a regular merge so `develop` and `main` can remain synchronized without rewriting development history.
9. Update local branches afterward using `git pull --ff-only` where possible.

---

## Versioning

Cycle Tracker follows [Semantic Versioning](https://semver.org/) during pre-1.0 development.

| Version | Meaning |
|---|---|
| `0.9.1` | Compatible bug fix or security fix |
| `0.10.0` | New functionality or meaningful pre-1.0 behavior change |
| `1.0.0` | First stable release |

After `1.0.0`, major version changes indicate breaking changes.

---

## Release Process

### 1. Update the changelog

Move relevant entries from `Unreleased` in `CHANGELOG.md` into a dated release section.

### 2. Update the version

```bash
npm version <patch|minor|major> --no-git-tag-version
```

### 3. Validate the release

Run the full project checks on `develop`:

```bash
npm run check
```

### 4. Merge into `main`

Open and merge the release pull request:

```text
develop → main
```

### 5. Create the release tag

On `main`:

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

### 6. Push the release

```bash
git push origin main --follow-tags
```

### 7. Synchronize `develop`

If the merge created a new commit on `main`, synchronize `develop` with the released state.

### 8. Publish the GitHub release

Create a GitHub Release using the corresponding section from `CHANGELOG.md`.

---

## Historical Commits

Do not rewrite old history or recreate historical tags solely to standardize earlier commit messages.

These conventions apply to new development going forward.