# UX decisions — Kachizaka

Each notable choice: decision · problem · principle (with source) · refused · cost · the signal that would say we are wrong.
Feedback: the pinned Discussion of the repository.

## 1. Every point shows its lines

- **Decision**: a prediction's points are always shown with the rules that earned them ("Right outcome +2 · Goal difference +1").
- **Problem**: a bare total invites suspicion between friends ("why does she have 3?").
- **Principle**: explanation satisfies the need for causal understanding; transparent scoring raises perceived fairness
  (procedural justice — Thibaut & Walker, 1975; Lind & Tyler, 1988).
- **Refused**: a total with a tooltip.
- **Cost**: a longer line per match.
- **Wrong if**: members stop reading the lines (no change in "why" questions in the league chat).

## 2. The seal is shown, not hidden

- **Decision**: the league page shows the rules, their version, "Sealed at the first kick-off" and the SHA-256 seal.
- **Problem**: trust in an organiser who could change the scoring.
- **Principle**: commitment devices are credible when observable (Schelling, *The Strategy of Conflict*, 1960).
- **Refused**: hiding the hash as a technical detail.
- **Cost**: a line of hexadecimal on the page.
- **Wrong if**: members ask what it is more than once — then explain it in words, keep it visible.

## 3. The table says when it is live

- **Decision**: a "Live" / "Reconnecting…" badge and the table's version above the standings.
- **Problem**: a table that silently stops updating misleads.
- **Principle**: visibility of system status (Nielsen, 10 usability heuristics, 1994).
- **Refused**: a spinner on the whole table.
- **Cost**: one badge.
- **Wrong if**: reconnects are frequent enough that the badge flickers — then debounce it.

## 4. The landing tells one story in five sections; its proof is computed by the product's own code

- **Decision**: five sections: the promise with one prediction scored by `@kachizaka/core` (the real scorer, the default
  rules, their seal), three outcomes (each card a way in), how it works in three steps with the magpie's promise as the
  film says it, trust (points only, sealed by the database, open source, Orazaka named once as « planned », the status from
  dev-preview.json), the closing call. One « Product » menu, no version chip; the footer is @krizaka/ui's SiteFooter.
- **Problem**: the old home had eight blocks; a visitor met sealed hashes and MCP before knowing what the game is.
- **Principle**: one idea per screen, proof before detail (progressive disclosure).
- **Refused**: a mock-up of the console with invented leagues; a recording, until a real league runs on dev.
- **Cost**: the proof is a computation, not the app in use — said under it; the recording comes with the first league on dev.
- **Signal we are wrong**: visitors ask whether they can win money.
