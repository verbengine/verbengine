# VerbEngine

AI-powered point-and-click adventure engine inspired by LucasArts classics.

## Project Overview

VerbEngine combines **Ink** (narrative scripting DSL) + **Phaser 3** (2D game engine) + **LLM generation** (Python backend) to create and play graphic adventures from text prompts.

## Architecture

```
[User Prompt] → [Python Backend + LLM] → [Ink DSL + Scene Metadata]
                                              ↓
                              [Phaser 3 Web Player] → [Playable Adventure]
```

- **Frontend**: Phaser 3 (TypeScript) — point-and-click player with simplified UI (left/right click)
- **Backend**: Python FastAPI — orchestrates LLM to generate Ink scripts + scene definitions
- **DSL**: Ink (inkle) — narrative scripting with custom extensions for scene metadata
- **Art style**: AI-generated pixel art, 320x200 aesthetic

## Tech Stack

- Frontend: TypeScript, Phaser 3, Vite
- Backend: Python 3.12+, FastAPI, inkjs (Ink runtime for JS)
- AI: Anthropic Claude API (or OpenAI compatible)
- Package managers: pnpm (frontend), uv (backend)

## Repository Structure

```
verbengine/
├── frontend/          # Phaser 3 web player (TypeScript)
├── backend/           # FastAPI server + LLM orchestration (Python)
├── dsl/               # Ink DSL extensions, examples, and schema
├── docs/              # Design specs and documentation
│   └── superpowers/
│       └── specs/     # Design documents
└── .claude/
    └── agents/        # Subagent definitions
```

## Git Workflow

### Branches
- `main` — stable releases only. Tagged with semver (v0.1.0, v0.2.0...)
- `develop` — integration branch. All feature PRs target here.
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

### Roles

- **Coordinator** (main Claude session): plans work, creates issues, assigns tasks, reviews progress
- **Developer** (`developer` agent): implements features, writes code, creates PRs
- **Reviewer** (`reviewer` agent): reviews PRs for quality, security, patterns compliance
- **QA** (`qa` agent): writes and runs tests, validates acceptance criteria, reports bugs

### The Process (strictly enforced)

```
1. DESIGN SPEC    — Every feature starts with a written spec in docs/superpowers/specs/
2. GITHUB ISSUE   — Spec is broken into GitHub Issues with acceptance criteria
3. BRANCH         — Developer creates feature/<issue>-<name> from develop
4. IMPLEMENT      — Developer writes code + tests
5. PR             — Developer opens PR to develop, references issue
6. REVIEW         — Reviewer agent reviews the PR
7. QA             — QA agent validates acceptance criteria
8. MERGE          — Squash merge to develop
9. RELEASE        — When milestone is complete: release branch → main → tag
```

### Rules That Cannot Be Broken

- **No code without an issue.** Every line of code traces back to a GitHub Issue.
- **No issue without a spec.** Every issue traces back to a design spec.
- **No merge without review.** Every PR is reviewed by the Reviewer agent.
- **No merge without QA.** Every PR is validated by the QA agent.
- **No direct commits to `develop` or `main`.** All changes go through PRs.
- **No PR without tests.** Every feature has tests. Every bug fix has a regression test.
- **Issues use labels:** `feature`, `bug`, `chore`, `docs`, `blocked`, `mvp`
- **Issues have acceptance criteria.** Written as checkboxes in the issue body.

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
- Minimal Ink DSL for adventures (scenes, hotspots, dialogue, inventory, exits)
- Phaser web player: render scene, click hotspots, dialogues, basic inventory, navigate scenes
- Backend endpoint: prompt → generated Ink DSL
- Placeholder images (colored rectangles) — AI art generation is v0.2.0

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
- Python: type hints, ruff for linting, pytest for tests
- Keep files focused and small — one responsibility per file
- No premature abstractions — three similar lines > one premature helper
- Tests for public APIs and game logic, not for glue code

### Dependencies
- Minimize external dependencies
- Prefer well-maintained, MIT/Apache licensed packages
- Frontend: Phaser 3, inkjs — no UI framework needed
- Backend: FastAPI, uvicorn, anthropic SDK
