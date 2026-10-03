# Why Do I Lose?

A browser-only app that finds the tactics you keep allowing in your chess losses. Design: see the project spec (`v1-scope.md`, `design.md`).

## Develop

```sh
npm install
npm test        # Vitest, run once
npm run test:watch
npm run check   # svelte-check + tsc
npm run dev
```

Development is test-first: every change starts with a failing test.

There is no hosted CI. Before opening or updating a PR, run `npm run verify` (type check, tests, build) and paste its output on the PR as evidence, with the commit it ran on.

## License

AGPL-3.0. Detector logic is ported from lichess-puzzler (AGPL-3.0) and import from openingtree (GPL-3.0).
