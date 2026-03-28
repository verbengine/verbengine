import type { Adventure } from "../types/adventure";

const FYSO_API_URL = import.meta.env.VITE_FYSO_API_URL as string | undefined;
const FYSO_CHANNEL_SLUG = import.meta.env.VITE_FYSO_CHANNEL_SLUG as string | undefined;

function getBaseUrl(): string {
  if (!FYSO_API_URL) {
    throw new Error("VITE_FYSO_API_URL environment variable is not set");
  }
  return FYSO_API_URL.replace(/\/+$/, "");
}

function getChannelSlug(): string {
  if (!FYSO_CHANNEL_SLUG) {
    throw new Error("VITE_FYSO_CHANNEL_SLUG environment variable is not set");
  }
  return FYSO_CHANNEL_SLUG;
}

interface FysoResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    executionTimeMs: number;
  };
}

interface FysoErrorResponse {
  success: false;
  error?: string;
  message?: string;
}

export class FysoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody?: unknown
  ) {
    super(message);
    this.name = "FysoApiError";
  }
}

async function fysoFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => null);
    }

    const errorMessage =
      body && typeof body === "object" && ("error" in body || "message" in body)
        ? (body as FysoErrorResponse).error ??
          (body as FysoErrorResponse).message ??
          `HTTP ${response.status}`
        : `HTTP ${response.status}`;

    throw new FysoApiError(errorMessage, response.status, body);
  }

  const json = (await response.json()) as FysoResponse<T>;

  if (!json.success) {
    throw new FysoApiError("Fyso API returned success: false", response.status, json);
  }

  return json.data;
}

function toolUrl(toolSlug: string): string {
  const channel = getChannelSlug();
  return `/api/channels/${channel}/tools/${toolSlug}/execute`;
}

export async function createAdventure(
  prompt: string,
  scenesCount: number
): Promise<Adventure> {
  const data = await fysoFetch<{ id: string; data: Adventure }>(
    toolUrl("create-adventure"),
    {
      method: "POST",
      body: JSON.stringify({ prompt, scenes_count: scenesCount }),
    }
  );

  return { ...data.data, id: data.id };
}

export async function getAdventure(id: string): Promise<Adventure> {
  const data = await fysoFetch<{ records: Adventure[]; total: number }>(
    toolUrl("get-adventure"),
    {
      method: "POST",
      body: JSON.stringify({ id }),
    }
  );

  if (data.records.length === 0) {
    throw new FysoApiError(`Adventure not found: ${id}`, 404);
  }

  return data.records[0];
}

export async function listAdventures(): Promise<Adventure[]> {
  const data = await fysoFetch<{ records: Adventure[]; total: number }>(
    toolUrl("list-adventures"),
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );

  return data.records;
}
