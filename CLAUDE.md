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

## Agent Workflow

This project uses a coordinator + subagent model:

- **Coordinator** (main Claude session): plans work, creates issues, assigns tasks, reviews progress
- **Developer** (`developer`): implements features, writes code, creates PRs
- **Reviewer** (`reviewer`): reviews PRs for quality, security, patterns compliance
- **QA** (`qa`): writes and runs tests, validates acceptance criteria, reports bugs

### Task Lifecycle
```
Coordinator creates Issue → Developer picks up → Developer opens PR →
Reviewer reviews PR → QA validates → Merge to develop
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
