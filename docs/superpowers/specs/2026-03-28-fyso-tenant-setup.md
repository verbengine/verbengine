# Fyso Tenant Setup — VerbEngine

**Date**: 2026-03-28
**Issue**: #10

## Overview

Fyso backend configuration for VerbEngine MVP. This document records the entity, rules, and API setup.

## Adventure Entity

**Name**: `adventures`
**Description**: AI-generated point-and-click adventures.

### Fields

| Field | Key | Type | Required | Description |
|-------|-----|------|----------|-------------|
| Title | `title` | text | yes | Adventure title |
| Prompt | `prompt` | textarea | yes | User prompt describing the adventure |
| Scenes Count | `scenes_count` | number | no | Number of scenes |
| Ink Script | `ink_script` | textarea | no | Generated Ink script |
| Scene Metadata | `scene_metadata` | textarea | no | JSON with scene definitions |
| Status | `status` | select | yes | generating / ready / error |

## API Endpoints (auto-generated)

Base URL: `https://api.fyso.dev`

| Operation | Method | Path |
|-----------|--------|------|
| List adventures | GET | `/api/entities/adventures/records` |
| Get adventure | GET | `/api/entities/adventures/records/{id}` |
| Create adventure | POST | `/api/entities/adventures/records` |
| Update adventure | PUT | `/api/entities/adventures/records/{id}` |
| Delete adventure | DELETE | `/api/entities/adventures/records/{id}` |

Authentication: `Authorization: Bearer {apiKey}` or `X-API-Key: {apiKey}`

## Business Rules

### 1. Set Generating Status (before_save)

- **ID**: `96cf3de4-9c0c-4e2d-b6bb-72f4ba727a04`
- **Trigger**: before_save, when `prompt` field changes
- **Action**: Sets `status` to `"generating"`
- **Priority**: 5

### 2. Generate Adventure (after_save)

- **ID**: `8f651f24-6abd-40f8-9334-f376a6d7ff8e`
- **Trigger**: after_save, when `status == "generating"`
- **Actions**:
  1. Calls LLM with adventure generation prompt
  2. Extracts Ink script from `ink` code block in response
  3. Extracts scene metadata JSON from `json` code block in response
  4. Maps results to `ink_script` and `scene_metadata` fields

### LLM Prompt Summary

The AI rule instructs the LLM to generate:
1. A complete Ink script with scene tags (`# SCENE`, `# BACKGROUND`), hotspot tags (`# HOTSPOT`, `# ITEM_PICKUP`, `# REQUIRES_ITEM`, `# EXIT`)
2. A scene metadata JSON with coordinates in 320x200 resolution

## API Key

- **Name**: `verbengine-frontend`
- **Key prefix**: `fyso_pkey_bc5776`
- Store securely in environment variable `FYSO_API_KEY`

## TypeScript Client

Generated client saved at: `src/api/fyso-client.ts`

Usage:
```typescript
import { FysoClient } from './api/fyso-client';

const client = new FysoClient({
  baseUrl: 'https://api.fyso.dev',
  apiKey: import.meta.env.VITE_FYSO_API_KEY,
});

// Create adventure (triggers AI generation)
const adventure = await client.adventures.create({
  title: 'My Adventure',
  prompt: 'A pirate adventure on a desert island...',
  status: 'generating',
});

// Poll for completion
const result = await client.adventures.get(adventure.id);
// result.status === 'ready' when generation is complete
```

## Known Issue

The AI provider (OpenAI) is configured in the tenant but the API key appears to be invalid or expired. The `ai_call` rule action returns "No AI provider configured for this tenant" during dry-run tests. A valid OpenAI API key needs to be set via:

```
fyso_ai configure_provider with a valid api_key
```

Once the AI provider is working, the full flow will be:
1. Frontend calls `POST /api/entities/adventures/records` with title + prompt
2. before_save rule sets status = "generating"
3. after_save rule calls LLM, extracts ink_script + scene_metadata
4. Record updated with generated content and status = "ready"
