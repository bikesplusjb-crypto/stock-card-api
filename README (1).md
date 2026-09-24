# Tests

Two independent things live here. They answer different questions and you
want both.

## `npm test` — the unit tests

    npm test

Eight files, 72 tests, no network, under a second. They test the pure
decision functions: fees, evidence quality, pool selection, listing
selection, the decision record, daily quotas, and price targets.

Most of them are about REFUSALS rather than answers, because a wrong
refusal is a missed deal and a wrong answer is somebody losing money on
a card. `targets.test.js` is the clearest example — the crossing logic
is four tests, the reasons not to send an email are five.

Several pull the function straight out of `server.js` by reading the
file and slicing it, rather than importing a copy (see
`server-helpers.js` and the top of `targets.test.js`). That is
deliberate: a test against a copy passes while the shipped code is
broken. It has happened here.

## The regression harness — did behaviour change?

    node test/regression/run.js --label before
    # ...make your change...
    node test/regression/run.js --label after
    node test/regression/diff.js before after

227 real card queries across 3 scenarios, replayed against cached
fixtures with no network calls. It prints every row whose verdict,
price, or refusal reason moved.

**"no changes" is the result you want** for anything meant to be
additive. It is the strongest evidence available that a server edit did
not quietly alter what a user sees. Every server change on 23 and 24
September was cleared this way.

When the diff DOES show changes, read every one before shipping. The
harness has no opinion about whether a change is good — only that it
happened.

Results land in `test/regression/results/`, which is gitignored: they
are run outputs, not source, and they are large.

## Fixtures

`test/regression/fixtures/` holds the cached sold-comp and scan-read
data the harness replays. See the README in that folder. They are
snapshots — refreshing them changes the baseline, so refresh
deliberately and re-run both labels afterwards.

## The seven that skip

In this repo alone, `npm test` reports **65 passing and 7 skipped**, and
that is the correct result — not a failure and not a problem.

Those seven check that the scanner's receipt and Sell/Keep/Grade panels
render exactly what the engine's decision record says, which means they
need `scanner.html` and `sort.html` from the **cardgauge-app** repo.
They look for it at `../../cardgauge-app/` and `../../app/` relative to
this folder, and skip cleanly when it is not there.

Check the two repos out side by side and all 72 run:

    parent/
      stock-card-api/     <- this repo
      cardgauge-app/      <- the site

They are worth running that way before a release. They are the only
tests that cross the seam between what the server decided and what the
page actually shows, and that seam is where a refusal can quietly turn
into a number on screen.
