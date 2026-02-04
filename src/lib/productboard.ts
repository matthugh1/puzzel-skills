/**
 * Productboard API Client
 * Reusable client for interacting with Productboard API v2
 * Supports API token and OAuth token authentication
 */

const PRODUCTBOARD_API_BASE = 'https://api.productboard.com';

/**
 * Productboard API client configuration
 */
export interface ProductboardConfig {
  /** API token or OAuth access token */
  token: string;
  /** Optional custom API base URL (defaults to https://api.productboard.com) */
  baseUrl?: string;
}

/**
 * Pagination links from Productboard API
 */
export interface PaginationLinks {
  self?: string;
  next?: string;
  prev?: string;
}

/**
 * Productboard API pagination response
 */
export interface PaginatedResponse<T> {
  data: T[];
  links: PaginationLinks;
}

/**
 * Productboard Feature
 */
export interface Feature {
  id: string;
  name: string;
  description?: string;
  status?: {
    id: string;
    name: string;
  };
  component?: {
    id: string;
    name: string;
  };
  parent?: {
    id: string;
    name: string;
  };
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * Productboard Component
 */
export interface Component {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * Productboard Note
 */
export interface Note {
  id: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * Productboard API Error
 */
export class ProductboardError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ProductboardError';
  }
}

/**
 * Productboard API Client
 * Provides methods to interact with Productboard API v2
 */
export class ProductboardClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: ProductboardConfig) {
    this.token = config.token;
    this.baseUrl = config.baseUrl || PRODUCTBOARD_API_BASE;

    if (!this.token) {
      throw new Error('Productboard token is required');
    }
  }

  /**
   * Make an authenticated request to Productboard API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}`,
        }));
        throw new ProductboardError(
          errorData.error || errorData.message || `Request failed with status ${response.status}`,
          response.status,
          errorData.code
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ProductboardError) {
        throw error;
      }
      console.error('Productboard API request error:', error);
      throw new ProductboardError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        0,
        'REQUEST_ERROR'
      );
    }
  }

  /**
   * Fetch all pages of a paginated endpoint
   */
  private async fetchAllPages<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T[]> {
    const allData: T[] = [];
    let nextUrl: string | undefined = endpoint;

    if (params) {
      const searchParams = new URLSearchParams(params);
      nextUrl = `${endpoint}?${searchParams.toString()}`;
    }

    while (nextUrl) {
      const response = await this.request<PaginatedResponse<T>>(nextUrl);
      allData.push(...response.data);

      // Extract next URL from links
      if (response.links?.next) {
        // Remove base URL if present, keep only path
        const nextPath = response.links.next.replace(this.baseUrl, '');
        nextUrl = nextPath;
      } else {
        nextUrl = undefined;
      }
    }

    return allData;
  }

  /**
   * List all features
   * 
   * @param options - Optional query parameters
   * @returns Array of all features (automatically paginated)
   * 
   * @example
   * ```typescript
   * const client = new ProductboardClient({ token: 'your-token' });
   * const features = await client.listFeatures();
   * ```
   */
  async listFeatures(options?: {
    componentId?: string;
    statusId?: string;
    parentId?: string;
  }): Promise<Feature[]> {
    const params: Record<string, string> = {};
    if (options?.componentId) params.componentId = options.componentId;
    if (options?.statusId) params.statusId = options.statusId;
    if (options?.parentId) params.parentId = options.parentId;

    return this.fetchAllPages<Feature>('/features', params);
  }

  /**
   * Get a single feature by ID
   * 
   * @param featureId - Feature ID
   * @returns Feature object
   */
  async getFeature(featureId: string): Promise<Feature> {
    return this.request<Feature>(`/features/${featureId}`);
  }

  /**
   * Create a new feature
   * 
   * @param data - Feature data
   * @returns Created feature
   */
  async createFeature(data: {
    name: string;
    description?: string;
    componentId?: string;
    statusId?: string;
    parentId?: string;
  }): Promise<Feature> {
    return this.request<Feature>('/features', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a feature
   * 
   * @param featureId - Feature ID
   * @param data - Feature update data
   * @returns Updated feature
   */
  async updateFeature(
    featureId: string,
    data: {
      name?: string;
      description?: string;
      componentId?: string;
      statusId?: string;
      parentId?: string;
    }
  ): Promise<Feature> {
    return this.request<Feature>(`/features/${featureId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * List all components
   * 
   * @returns Array of all components (automatically paginated)
   * 
   * @example
   * ```typescript
   * const client = new ProductboardClient({ token: 'your-token' });
   * const components = await client.listComponents();
   * ```
   */
  async listComponents(): Promise<Component[]> {
    return this.fetchAllPages<Component>('/components');
  }

  /**
   * Get a single component by ID
   * 
   * @param componentId - Component ID
   * @returns Component object
   */
  async getComponent(componentId: string): Promise<Component> {
    return this.request<Component>(`/components/${componentId}`);
  }

  /**
   * Create a new component
   * 
   * @param data - Component data
   * @returns Created component
   */
  async createComponent(data: {
    name: string;
    description?: string;
  }): Promise<Component> {
    return this.request<Component>('/components', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a component
   * 
   * @param componentId - Component ID
   * @param data - Component update data
   * @returns Updated component
   */
  async updateComponent(
    componentId: string,
    data: {
      name?: string;
      description?: string;
    }
  ): Promise<Component> {
    return this.request<Component>(`/components/${componentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * List notes (if supported by your Productboard plan)
   * 
   * @param options - Optional query parameters
   * @returns Array of notes (automatically paginated)
   */
  async listNotes(options?: {
    featureId?: string;
  }): Promise<Note[]> {
    const params: Record<string, string> = {};
    if (options?.featureId) params.featureId = options.featureId;

    return this.fetchAllPages<Note>('/notes', params);
  }

  /**
   * Get a single note by ID
   * 
   * @param noteId - Note ID
   * @returns Note object
   */
  async getNote(noteId: string): Promise<Note> {
    return this.request<Note>(`/notes/${noteId}`);
  }

  /**
   * Create a new note
   * 
   * @param data - Note data
   * @returns Created note
   */
  async createNote(data: {
    content: string;
    featureId?: string;
  }): Promise<Note> {
    return this.request<Note>('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a note
   * 
   * @param noteId - Note ID
   * @param data - Note update data
   * @returns Updated note
   */
  async updateNote(
    noteId: string,
    data: {
      content?: string;
    }
  ): Promise<Note> {
    return this.request<Note>(`/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

/**
 * Create a Productboard client instance
 * 
 * @param config - Client configuration with token
 * @returns ProductboardClient instance
 * 
 * @example
 * ```typescript
 * const client = createProductboardClient({
 *   token: process.env.PRODUCTBOARD_TOKEN!
 * });
 * const features = await client.listFeatures();
 * ```
 */
export function createProductboardClient(
  config: ProductboardConfig
): ProductboardClient {
  return new ProductboardClient(config);
}
