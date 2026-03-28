# VerbEngine

AI-powered point-and-click adventure engine inspired by LucasArts classics.

## Project Overview

VerbEngine combines **Ink** (narrative scripting DSL) + **Phaser 3** (2D game engine) + **Fyso** (backend: persistence, API, AI) to create and play graphic adventures from text prompts.

## Architecture

```
[User Prompt] → [Fyso Backend (AI Rule)] → [Ink DSL + Scene Metadata]
                                                  ↓
                                  [Phaser 3 SPA Player] → [Playable Adventure]
```

- **Frontend**: Phaser 3 (TypeScript) — SPA, no SSR. Point-and-click player with simplified UI
- **Backend**: Fyso — entities, channels (API), AI rules for LLM generation
- **DSL**: Ink (inkle) — narrative scripting with scene metadata JSON
- **Art style**: AI-generated pixel art, 320x200 aesthetic (v0.2.0; MVP uses color placeholders)

## Tech Stack

- **Language**: TypeScript only (no Python, no server-side code)
- **Game engine**: Phaser 3
- **Ink runtime**: inkjs (browser)
- **Build tool**: Vite
- **Backend**: Fyso (entities + channels + AI rules)
- **Package manager**: pnpm
- **Hosting**: Static (GitHub Pages / Vercel / Netlify / Cloudflare Pages)

## Repository Structure

```
verbengine/
├── src/                   # Phaser 3 SPA (TypeScript)
│   ├── main.ts
│   ├── scenes/
│   ├── engine/
│   ├── api/               # Fyso API client
│   └── types/
├── dsl/                   # Ink DSL examples and schema
│   └── examples/
├── docs/                  # Design specs and documentation
│   └── superpowers/
│       └── specs/
├── .claude/
│   └── agents/            # Subagent definitions
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── CLAUDE.md
└── LICENSE
```

**There is no `backend/` directory.** Fyso is the backend, configured externally.

## Git Workflow

### Branches
- `main` — stable releases only. Tagged with semver (v0.1.0, v0.2.0...)
- `develop` — integration branch. All feature PRs target here
- `feature/<issue-number>-<short-name>` — feature branches from develop
- `fix/<issue-number>-<short-name>` — bugfix branches from develop
- `release/<version>` — release prep branches from develop, merged to main

### Flow
1. Work is tracked via **GitHub Issues** (labels: `feature`, `bug`, `chore`, `docs`)
2. Developer creates branch from `develop`, implements, pushes
3. PR to `develop` — reviewer approves, QA validates
4. Merge to `develop` via squash merge
5. Release cut: branch `release/vX.Y.Z` from `develop`, merge to `main`, tag

### Commit Messages
Follow conventional commits:
- `feat: add inventory system`
- `fix: hotspot click detection on mobile`
- `docs: update DSL reference`
- `chore: configure CI pipeline`

## Language Policy

All code, comments, commits, PRs, issues, and documentation are in **English**.

## Mandatory Development Process

**ALL work MUST follow this process. No exceptions. No shortcuts.**

<roles>
- Coordinator (main Claude session): plans work, creates issues, assigns tasks, reviews progress
- Developer (developer agent): implements features, writes code, pushes branches
- Reviewer (reviewer agent): reviews PRs for quality, security, patterns compliance
- QA (qa agent): runs tests, validates acceptance criteria, reports bugs
</roles>

<process>
1. DESIGN SPEC — Every feature starts with a written spec in docs/superpowers/specs/
2. GITHUB ISSUE — Spec is broken into GitHub Issues with acceptance criteria
3. BRANCH — Developer creates feature/issue-name from develop
4. IMPLEMENT — Developer writes code + tests
5. PR — Coordinator opens PR to develop, references issue
6. REVIEW — Reviewer agent reviews the PR
7. QA — QA agent validates acceptance criteria
8. MERGE — Squash merge to develop (ONLY after both Review AND QA pass)
9. RELEASE — When milestone is complete: release branch to main, tag
</process>

<rules>
- No code without an issue. Every line of code traces back to a GitHub Issue.
- No issue without a spec. Every issue traces back to a design spec.
- No merge without review. Every PR is reviewed by the Reviewer agent.
- No merge without QA. EVERY SINGLE PR MUST PASS QA BEFORE MERGE. NO EXCEPTIONS.
- No direct commits to develop or main. All changes go through PRs.
- No PR without tests. Every feature has tests. Every bug fix has a regression test.
- Issues use labels: feature, bug, chore, docs, blocked, mvp.
- Issues have acceptance criteria written as checkboxes in the issue body.
</rules>

<what_coordinator_does>
- Plans work, creates GitHub issues, assigns to developer agents
- Creates PRs after developer pushes branch
- Dispatches reviewer and QA agents (can run in parallel)
- Merges PRs ONLY after both reviewer AND QA approve
- Manages release cuts from develop to main
</what_coordinator_does>

<what_coordinator_does_not_do>
- Never writes code directly. All implementation is delegated to Developer agents using worktrees.
- Never merges a PR without QA passing. The sequence is ALWAYS: Review + QA then Merge.
- Never skips the QA step. This is a hard rule with zero tolerance.
- Never uses Fyso tools without first querying context7 for up-to-date documentation.
</what_coordinator_does_not_do>

### Issue Template

```markdown
## Description
What needs to be done and why.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Spec Reference
Link to design spec: docs/superpowers/specs/<spec-file>.md

## Notes
Any technical notes or constraints.
```

### PR Template

```markdown
## Summary
Brief description. Closes #<issue-number>

## Changes
- Bullet list of changes

## Test Plan
- How to verify this works

## Screenshots
(if applicable)
```

## Development Guidelines

### MVP Scope (v0.1.0)
- Ink DSL for adventures (scenes, hotspots, dialogue, inventory, exits)
- Phaser SPA player: render scene, click hotspots, dialogues, basic inventory, navigate scenes
- Fyso backend: Adventure entity, channel API, AI rule for generation
- Placeholder visuals (colored rectangles) — AI art generation is v0.2.0

### NOT in MVP
- AI image generation
- Runtime dynamic dialogues with LLM
- Visual editor
- Audio/music
- Character animations
- Pathfinding / walkable areas
- Save/load

### Code Style
- TypeScript: strict mode, no `any`, prefer interfaces over types
- Keep files focused and small — one responsibility per file
- No premature abstractions — three similar lines > one premature helper
- Tests for public APIs and game logic, not for glue code
- Vitest for testing

### Dependencies
- Minimize external dependencies
- Prefer well-maintained, MIT/Apache licensed packages
- Core: Phaser 3, inkjs — no UI framework needed
- No server-side dependencies — Fyso handles all backend concerns
