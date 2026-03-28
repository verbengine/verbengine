// Auto-generated Fyso API Client
// Generated at: 2026-03-28
// Framework: fetch
// Do not edit manually — regenerate with: fyso_meta api_client

// ============= Types =============

export interface ListParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  resolve?: boolean;
  [key: `filter.${string}`]: string | undefined;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
}

export class FysoApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'FysoApiError';
  }
}

/**
 * Adventures
 * AI-generated point-and-click adventures. Each adventure has an Ink script,
 * scene metadata JSON, and generation status.
 */
export interface Adventure {
  id: string;
  title: string;
  prompt: string;
  scenes_count?: number;
  ink_script?: string;
  scene_metadata?: string;
  status: 'generating' | 'ready' | 'error';
  created_at: string;
  updated_at: string;
}

export interface CreateAdventure {
  title: string;
  prompt: string;
  scenes_count?: number;
  ink_script?: string;
  scene_metadata?: string;
  status?: 'generating' | 'ready' | 'error';
}

export type UpdateAdventure = Partial<CreateAdventure>;

// ============= Client =============

export interface FysoConfig {
  baseUrl: string;
  apiKey: string;
}

export class FysoClient {
  private config: FysoConfig;

  constructor(config: FysoConfig) {
    this.config = config;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json() as { success: boolean; data?: T; error?: ApiError };

    if (!data.success) {
      throw new FysoApiError(
        data.error?.code || 'UNKNOWN_ERROR',
        data.error?.message || 'An unknown error occurred'
      );
    }

    return data.data as T;
  }

  private buildQueryString(params?: ListParams): string {
    if (!params) return '';
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const query = searchParams.toString();
    return query ? `?${query}` : '';
  }

  adventures = {
    list: (params?: ListParams) =>
      this.request<PaginatedResponse<Adventure>>(
        'GET',
        `/api/entities/adventures/records${this.buildQueryString(params)}`
      ),
    get: (id: string, resolve?: boolean) =>
      this.request<Adventure>(
        'GET',
        `/api/entities/adventures/records/${id}${resolve ? '?resolve=true' : ''}`
      ),
    create: (data: CreateAdventure) =>
      this.request<Adventure>(
        'POST',
        '/api/entities/adventures/records',
        data
      ),
    update: (id: string, data: UpdateAdventure) =>
      this.request<Adventure>(
        'PUT',
        `/api/entities/adventures/records/${id}`,
        data
      ),
    delete: (id: string) =>
      this.request<void>(
        'DELETE',
        `/api/entities/adventures/records/${id}`
      ),
  };
}
