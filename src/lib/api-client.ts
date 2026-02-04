/**
 * Client-side API utility for making authenticated requests
 * Includes CSRF token support and httpOnly cookie handling
 */

const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

/**
 * Get auth token from localStorage (legacy support)
 * Prefer httpOnly cookies set by server
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * Get CSRF token from cookies
 */
function getCSRFToken(): string | null {
  if (typeof document === 'undefined') return null;
  
  // Try reading from document.cookie
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    const [name, ...valueParts] = trimmed.split('=');
    if (name === 'csrf-token' && valueParts.length > 0) {
      const value = valueParts.join('='); // Handle values with = in them
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Ensure CSRF token is available by fetching it from the dedicated endpoint
 * This ensures the middleware runs and the cookie is set
 */
async function ensureCSRFToken(): Promise<string | null> {
  const existingToken = getCSRFToken();
  if (existingToken) {
    return existingToken;
  }

  // Fetch CSRF token from dedicated endpoint
  // This will trigger middleware to set the cookie if it doesn't exist
  try {
    const response = await fetch(`${API_BASE_URL}/api/csrf-token`, {
      method: 'GET',
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      if (data.token) {
        // Cookie should now be set, try reading it
        return getCSRFToken() || data.token;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    return null;
  }
}

/**
 * Make an authenticated API request
 * Automatically includes CSRF token for state-changing operations
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const method = options.method || 'GET';
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Add CSRF token for state-changing operations
  if (isStateChanging) {
    let csrfToken = getCSRFToken();
    // If token not found, try to ensure it's available by triggering middleware
    if (!csrfToken) {
      csrfToken = await ensureCSRFToken();
    }
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    } else {
      // If still no CSRF token found, throw an error with helpful message
      throw new Error('CSRF token missing. Please refresh the page and try again.');
    }
  }

  // Include credentials to send cookies (for httpOnly JWT tokens)
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Important for httpOnly cookies
  };

  console.log(`[api-client] Making ${options.method || 'GET'} request to ${endpoint}`);
  const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);
  console.log(`[api-client] Response status: ${response.status} for ${endpoint}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    console.error(`[api-client] Request failed:`, error);
    const apiError = new Error(error.error || `HTTP ${response.status}`);
    // Preserve validation details if present
    if (error.details) {
      (apiError as Error & { details: unknown }).details = error.details;
    }
    throw apiError;
  }

  const data = await response.json();
  console.log(`[api-client] Request successful for ${endpoint}`);
  return data;
}

/**
 * API methods for skills
 */
export const skillsApi = {
  list: (params?: {
    category?: string;
    search?: string;
    status?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);

    const query = searchParams.toString();
    return apiRequest<{ skills: unknown[] }>(
      `/api/skills${query ? `?${query}` : ''}`
    );
  },

  getById: (id: string) => {
    return apiRequest<{ skill: unknown }>(`/api/skills/${id}`);
  },

  create: (data: {
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
    content: string;
    visibility?: 'TEAM' | 'ORG';
    toolId?: string;
    inputContract?: Record<string, unknown>;
    outputContract?: Record<string, unknown>;
  }) => {
    return apiRequest<{ skill: unknown }>('/api/skills', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id: string, data: {
    name?: string;
    description?: string;
    category?: string;
    tags?: string[];
    visibility?: 'TEAM' | 'ORG';
    toolId?: string | null; // null means explicitly remove tool, undefined means don't change
    inputContract?: Record<string, unknown> | null;
    outputContract?: Record<string, unknown> | null;
  }) => {
    // Always include toolId if it's in the data (even if null) so API knows to update it
    const body: Record<string, unknown> = { ...data };
    console.log('[api-client] skillsApi.update - sending body:', JSON.stringify(body, null, 2));
    return apiRequest<{ skill: unknown }>(`/api/skills/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  archive: (id: string) => {
    return apiRequest<{ success: boolean }>(`/api/skills/${id}`, {
      method: 'DELETE',
    });
  },

  getVersions: (id: string) => {
    return apiRequest<{ versions: unknown[] }>(`/api/skills/${id}/versions`);
  },

  createVersion: (id: string, data: {
    content: string;
    changeNotes?: string;
    inputContract?: Record<string, unknown>;
    outputContract?: Record<string, unknown>;
  }) => {
    return apiRequest<{ version: unknown }>(`/api/skills/${id}/versions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  submitForApproval: (id: string, versionId: string) => {
    return apiRequest<{ version: unknown }>(`/api/skills/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ versionId }),
    });
  },

  approve: (id: string, versionId: string, comments?: string) => {
    return apiRequest<{ version: unknown }>(`/api/skills/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ versionId, comments }),
    });
  },

  reject: (id: string, versionId: string, reason: string) => {
    return apiRequest<{ version: unknown }>(`/api/skills/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ versionId, reason }),
    });
  },

  compose: (messages: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    return apiRequest<{
      response: {
        type: 'question' | 'proposal';
        question?: string;
        skill?: {
          name: string;
          description?: string;
          content: string;
          category?: string;
          tags?: string[];
          inputContract?: Record<string, unknown>;
          outputContract?: Record<string, unknown>;
        };
      };
      model: string;
    }>('/api/skills/compose', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
  },
};

/**
 * API methods for agent runs
 */
export const runsApi = {
  list: () => {
    return apiRequest<{ runs: unknown[] }>('/api/runs');
  },

  getById: (id: string) => {
    return apiRequest<{ run: unknown }>(`/api/runs/${id}`);
  },

  create: (data: {
    goal: string;
    initialContext: Record<string, unknown>;
    policyId?: string;
    inputAllowlist?: string[] | null;
    idempotencyKey?: string;
  }) => {
    return apiRequest<{ run: unknown }>('/api/runs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  cancel: (id: string, reason?: string) => {
    return apiRequest<{ run: unknown }>(`/api/runs/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  getArtefacts: (id: string) => {
    return apiRequest<{ artefacts: unknown[] }>(`/api/runs/${id}/artefacts`);
  },

  approve: (id: string, comments?: string) => {
    return apiRequest<{ run: unknown; approval: unknown }>(`/api/runs/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comments }),
    });
  },

  reject: (id: string, reason: string) => {
    return apiRequest<{ run: unknown; approval: unknown }>(`/api/runs/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};

/**
 * API methods for workflows
 */
export const workflowsApi = {
  list: (params?: {
    category?: string;
    search?: string;
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    visibility?: 'TEAM' | 'ORG';
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.visibility) searchParams.set('visibility', params.visibility);

    const query = searchParams.toString();
    return apiRequest<{ workflows: unknown[] }>(
      `/api/workflows${query ? `?${query}` : ''}`
    );
  },

  getById: (id: string) => {
    return apiRequest<{ workflow: unknown }>(`/api/workflows/${id}`);
  },

  create: (data: {
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
    plan: {
      steps: unknown[];
      metadata?: {
        version?: string;
        description?: string;
      };
    };
    visibility?: 'TEAM' | 'ORG';
    llmProvider?: 'openai' | 'anthropic';
    llmModel?: string;
  }) => {
    return apiRequest<{ workflow: unknown }>('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id: string, data: {
    name?: string;
    description?: string;
    category?: string;
    tags?: string[];
    plan?: {
      steps: unknown[];
      metadata?: {
        version?: string;
        description?: string;
      };
    };
    visibility?: 'TEAM' | 'ORG';
  }) => {
    return apiRequest<{ workflow: unknown }>(`/api/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  archive: (id: string) => {
    return apiRequest<{ success: boolean }>(`/api/workflows/${id}`, {
      method: 'DELETE',
    });
  },

  publish: (id: string) => {
    return apiRequest<{ workflow: unknown }>(`/api/workflows/${id}/publish`, {
      method: 'POST',
    });
  },

  unpublish: (id: string) => {
    return apiRequest<{ workflow: unknown }>(`/api/workflows/${id}/unpublish`, {
      method: 'POST',
    });
  },

  run: (id: string, data: {
    initialContext: Record<string, unknown>;
    policyId?: string;
    inputAllowlist?: string[] | null;
    idempotencyKey?: string;
  }) => {
    return apiRequest<{ run: unknown }>(`/api/workflows/${id}/run`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  test: async (id: string, data: {
    initialContext?: Record<string, unknown>;
    policyId?: string;
    inputAllowlist?: string[] | null;
    idempotencyKey?: string;
    plan?: {
      steps: unknown[];
      metadata?: {
        version?: string;
        description?: string;
      };
    };
    files?: Map<string, File>; // Optional files to upload
    llmProvider?: 'openai' | 'anthropic';
    llmModel?: string;
  }) => {
    console.log('[api-client] workflowsApi.test called', { id, hasPlan: !!data.plan, hasFiles: !!data.files?.size });
    
    // If files are present, use FormData
    if (data.files && data.files.size > 0) {
      // Ensure CSRF token is available (same as apiRequest does)
      let csrfToken = getCSRFToken();
      if (!csrfToken) {
        csrfToken = await ensureCSRFToken();
      }
      if (!csrfToken) {
        throw new Error('CSRF token missing. Please refresh the page and try again.');
      }

      const formData = new FormData();
      
      // Add JSON data
      const { files, ...jsonData } = data;
      formData.append('data', JSON.stringify(jsonData));
      
      // Add files
      for (const [fieldName, file] of files.entries()) {
        formData.append(fieldName, file);
      }
      
      // Use FormData for file uploads
      // Note: Don't set Content-Type header - browser will set it with boundary
      return fetch(`${API_BASE_URL}/api/workflows/${id}/test`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: formData,
      }).then(async (response) => {
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(error.error || error.details || `Request failed: ${response.status}`);
        }
        return response.json();
      }).then((response) => {
        console.log('[api-client] workflowsApi.test response:', response);
        return response;
      }).catch((error) => {
        console.error('[api-client] workflowsApi.test error:', error);
        throw error;
      });
    }
    
    // Otherwise use JSON
    return apiRequest<{ run: unknown }>(`/api/workflows/${id}/test`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((response) => {
      console.log('[api-client] workflowsApi.test response:', response);
      return response;
    }).catch((error) => {
      console.error('[api-client] workflowsApi.test error:', error);
      throw error;
    });
  },

  // Triggers
  listTriggers: (id: string) => {
    return apiRequest<{ triggers: unknown[]; webhookEndpoints: unknown[] }>(
      `/api/workflows/${id}/triggers`
    );
  },

  createTrigger: (id: string, data: {
    triggerType: 'MANUAL' | 'WEBHOOK' | 'SCHEDULED' | 'APP_EVENT';
    config: Record<string, unknown>;
  }) => {
    return apiRequest<{ trigger: unknown; webhookEndpoint?: unknown }>(
      `/api/workflows/${id}/triggers`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  updateTrigger: (id: string, triggerId: string, data: {
    config?: Record<string, unknown>;
    status?: 'ACTIVE' | 'PAUSED' | 'ERROR';
  }) => {
    return apiRequest<{ trigger: unknown }>(
      `/api/workflows/${id}/triggers/${triggerId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  },

  deleteTrigger: (id: string, triggerId: string) => {
    return apiRequest<{ success: boolean }>(
      `/api/workflows/${id}/triggers/${triggerId}`,
      {
        method: 'DELETE',
      }
    );
  },

  // Sharing
  share: (id: string, data: {
    userId: string;
    permission: 'VIEWER' | 'EDITOR';
  }) => {
    return apiRequest<{ share: unknown }>(`/api/workflows/${id}/share`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  unshare: (id: string, userId: string) => {
    return apiRequest<{ success: boolean }>(`/api/workflows/${id}/share/${userId}`, {
      method: 'DELETE',
    });
  },

  getSharedWith: (id: string) => {
    return apiRequest<{ shares: unknown[] }>(`/api/workflows/${id}/shared-with`);
  },

  getHistory: (id: string) => {
    return apiRequest<{ history: unknown[] }>(`/api/workflows/${id}/history`);
  },

  archive: (id: string) => {
    return apiRequest<{ workflow: unknown }>(`/api/workflows/${id}/archive`, {
      method: 'POST',
    });
  },

  unarchive: (id: string) => {
    return apiRequest<{ workflow: unknown }>(`/api/workflows/${id}/unarchive`, {
      method: 'POST',
    });
  },

  moveToFolder: (id: string, folderId: string | null) => {
    return apiRequest<{ workflow: unknown }>(`/api/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ folderId }),
    });
  },
};

/**
 * API methods for folders
 */
export const foldersApi = {
  list: () => {
    return apiRequest<{ folders: unknown[] }>('/api/folders');
  },

  create: (data: {
    name: string;
    description?: string;
    parentId?: string | null;
  }) => {
    return apiRequest<{ folder: unknown }>('/api/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id: string, data: {
    name?: string;
    description?: string | null;
    parentId?: string | null;
  }) => {
    return apiRequest<{ folder: unknown }>(`/api/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: (id: string) => {
    return apiRequest<{ success: boolean }>(`/api/folders/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * API methods for app integrations
 */
export const integrationsApi = {
  list: () => {
    return apiRequest<{ available: unknown[]; connected: unknown[] }>('/api/integrations');
  },

  connect: (app: string) => {
    return apiRequest<{ authUrl: string }>(`/api/integrations/${app}/connect`, {
      method: 'POST',
    });
  },

  disconnect: (app: string) => {
    return apiRequest<{ success: boolean }>(`/api/integrations/${app}`, {
      method: 'DELETE',
    });
  },

  getActions: (app: string) => {
    return apiRequest<{ actions: unknown[] }>(`/api/integrations/${app}/actions`);
  },
};

/**
 * API methods for batch runs
 */
export const batchesApi = {
  getById: (id: string) => {
    return apiRequest<{ batch: unknown }>(`/api/batches/${id}`);
  },

  createBatchRun: (workflowId: string, data: {
    items: Array<{
      initialContext: Record<string, unknown>;
      idempotencyKey?: string;
    }>;
    concurrency?: number;
    policyId?: string;
  }) => {
    return apiRequest<{ batch: unknown }>(`/api/workflows/${workflowId}/batch-run`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

/**
 * API methods for users
 */
export const usersApi = {
  list: () => {
    return apiRequest<{ users: unknown[] }>('/api/users');
  },
};

/**
 * API methods for agents
 */
export const agentsApi = {
  list: () => {
    return apiRequest<{ agents: unknown[] }>('/api/agents');
  },
};

/**
 * API methods for org charts
 */
export const orgChartsApi = {
  list: () => {
    return apiRequest<{ charts: unknown[] }>('/api/org-charts');
  },

  create: (data: { name: string; visibility?: 'TEAM' | 'ORG'; isDefault?: boolean }) => {
    return apiRequest<{ chart: unknown }>('/api/org-charts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id: string, data: { name?: string; visibility?: 'TEAM' | 'ORG'; isDefault?: boolean }) => {
    return apiRequest<{ chart: unknown }>(`/api/org-charts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  getById: (id: string) => {
    return apiRequest<{ chart: unknown }>(`/api/org-charts/${id}`);
  },

  getNodes: (id: string) => {
    return apiRequest<{ nodes: unknown[] }>(`/api/org-charts/${id}/nodes`);
  },

  createNode: (id: string, data: {
    type: 'DEPARTMENT' | 'TEAM' | 'AGENT';
    name: string;
    parentId?: string;
    agentId?: string;
    roleTitle?: string;
    departmentLabel?: string;
    order?: number;
  }) => {
    return apiRequest<{ node: unknown }>(`/api/org-charts/${id}/nodes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateNode: (id: string, nodeId: string, data: {
    name?: string;
    parentId?: string | null;
    roleTitle?: string;
    departmentLabel?: string;
    order?: number;
  }) => {
    return apiRequest<{ node: unknown }>(`/api/org-charts/${id}/nodes/${nodeId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteNode: (id: string, nodeId: string) => {
    return apiRequest<{ success: boolean }>(`/api/org-charts/${id}/nodes/${nodeId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * API methods for tasks
 */
export const tasksApi = {
  list: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return apiRequest<{ tasks: unknown[] }>(`/api/tasks${query}`);
  },

  complete: (id: string, data: { result?: Record<string, unknown> }) => {
    return apiRequest<{ success: boolean }>(`/api/tasks/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

/**
 * API methods for data inputs
 */
export const dataInputsApi = {
  list: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return apiRequest<{ dataInputs: unknown[] }>(`/api/data-inputs${query}`);
  },

  submit: (id: string, data: { data: Record<string, unknown> }) => {
    return apiRequest<{ success: boolean }>(`/api/data-inputs/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

/**
 * API methods for workspaces
 */
export const workspacesApi = {
  list: () => {
    return apiRequest<{ workspaces: unknown[] }>('/api/workspaces');
  },

  getById: (id: string) => {
    return apiRequest<{ workspace: unknown }>(`/api/workspaces/${id}`);
  },

  create: (data: { name: string; description?: string; slug: string }) => {
    return apiRequest<{ workspace: unknown }>('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id: string, data: { name?: string; description?: string; slug?: string; isActive?: boolean }) => {
    return apiRequest<{ workspace: unknown }>(`/api/workspaces/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: (id: string) => {
    return apiRequest<{ workspace: unknown }>(`/api/workspaces/${id}`, {
      method: 'DELETE',
    });
  },

  getMembers: (id: string) => {
    return apiRequest<{ members: unknown[] }>(`/api/workspaces/${id}/members`);
  },

  addMember: (id: string, data: { userId: string; role?: 'OWNER' | 'ADMIN' | 'MEMBER' }) => {
    return apiRequest<{ member: unknown }>(`/api/workspaces/${id}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateMember: (id: string, userId: string, data: { role: 'OWNER' | 'ADMIN' | 'MEMBER' }) => {
    return apiRequest<{ member: unknown }>(`/api/workspaces/${id}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  removeMember: (id: string, userId: string) => {
    return apiRequest<{ success: boolean }>(`/api/workspaces/${id}/members/${userId}`, {
      method: 'DELETE',
    });
  },

  chat: (id: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>, options?: {
    skillId?: string;
    toolId?: string;
    toolArgs?: Record<string, unknown>;
    appId?: string;
    actionId?: string;
    actionParams?: Record<string, unknown>;
    files?: Map<string, File>;
  }) => {
    // If files are present, use FormData
    if (options?.files && options.files.size > 0) {
      // Ensure CSRF token is available
      let csrfToken = getCSRFToken();
      if (!csrfToken) {
        return ensureCSRFToken().then((token) => {
          if (!token) {
            throw new Error('CSRF token missing. Please refresh the page and try again.');
          }
          return sendChatWithFiles(id, messages, options, token);
        });
      }
      return sendChatWithFiles(id, messages, options, csrfToken);
    }
    
    // Otherwise use JSON
    return apiRequest<{ response: { type: 'message' | 'skill_result' | 'tool_result' | 'app_action_result'; content: string; skillId?: string; toolId?: string; appId?: string; actionId?: string; result?: unknown; canEscalate?: boolean; selectedTools?: Array<{ id: string; name: string; description: string }> } }>(`/api/workspaces/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({
        messages,
        skillId: options?.skillId,
        toolId: options?.toolId,
        toolArgs: options?.toolArgs,
        appId: options?.appId,
        actionId: options?.actionId,
        actionParams: options?.actionParams,
      }),
    });
  },

  getSkills: (id: string) => {
    return apiRequest<{ skills: unknown[] }>(`/api/workspaces/${id}/skills`);
  },

  executeSkill: (id: string, skillId: string, inputs: Record<string, unknown>) => {
    return apiRequest<{ result: string; success: boolean }>(`/api/workspaces/${id}/skills/${skillId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ inputs }),
    });
  },

  getIntegrations: (id: string) => {
    return apiRequest<{ integrations: unknown[] }>(`/api/workspaces/${id}/integrations`);
  },
};

/**
 * Helper function to send chat request with files using FormData
 */
async function sendChatWithFiles(
  id: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  options: { skillId?: string; toolId?: string; toolArgs?: Record<string, unknown>; files?: Map<string, File> },
  csrfToken: string
): Promise<{ response: { type: 'message' | 'skill_result' | 'tool_result'; content: string; skillId?: string; toolId?: string; result?: unknown; canEscalate?: boolean; selectedTools?: Array<{ id: string; name: string; description: string }> } }> {
  const formData = new FormData();
  
  // Add JSON data
  const { files, ...jsonData } = options;
  formData.append('data', JSON.stringify({
    messages,
    ...jsonData,
  }));
  
  // Add files
  if (files) {
    for (const [fieldName, file] of files.entries()) {
      formData.append(fieldName, file);
    }
  }
  
  // Use FormData for file uploads
  // Note: Don't set Content-Type header - browser will set it with boundary
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${id}/chat`, {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: formData,
  });
  
  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    let errorDetails: unknown = null;
    let errorStack: string | undefined = undefined;
    let errorName: string | undefined = undefined;
    
    try {
      const error = await response.json();
      errorMessage = error.error || error.message || errorMessage;
      
      // Handle details - make sure it's a string
      if (error.details !== undefined) {
        if (typeof error.details === 'string') {
          errorDetails = error.details;
          errorMessage = `${errorMessage}: ${error.details}`;
        } else if (typeof error.details === 'object' && error.details !== null) {
          // If details is an object, stringify it properly
          try {
            const detailsStr = JSON.stringify(error.details, null, 2);
            errorDetails = detailsStr;
            errorMessage = `${errorMessage}\n\nDetails:\n${detailsStr}`;
          } catch (stringifyError) {
            errorDetails = String(error.details);
            errorMessage = `${errorMessage}: ${String(error.details)}`;
          }
        } else {
          errorDetails = String(error.details);
          errorMessage = `${errorMessage}: ${String(error.details)}`;
        }
      } else if (error.stack) {
        errorDetails = error.stack;
        errorMessage = `${errorMessage}\n\nStack trace:\n${error.stack}`;
      }
      
      errorStack = error.stack;
      errorName = error.name || 'Error';
    } catch (e) {
      // If response is not JSON, try to get text
      try {
        const text = await response.text();
        if (text) {
          errorMessage = text;
        }
      } catch (textError) {
        // Ignore text parsing errors
      }
    }
    
    const fullError = new Error(errorMessage);
    
    // Store details as a string to avoid [object Object] issues
    if (errorDetails) {
      const detailsStr = typeof errorDetails === 'string' 
        ? errorDetails 
        : JSON.stringify(errorDetails, null, 2);
      (fullError as unknown as { details: string }).details = detailsStr;
    }
    if (errorStack) {
      (fullError as unknown as { stack: string }).stack = errorStack;
    }
    if (errorName) {
      (fullError as unknown as { name: string }).name = errorName;
    }
    
    console.error('[API Client] Request failed:', {
      status: response.status,
      statusText: response.statusText,
      errorMessage,
      errorDetails: typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails),
      errorStack,
    });
    
    throw fullError;
  }
  
  return response.json();
}

/**
 * API methods for tools
 */
export const toolsApi = {
  list: () => {
    return apiRequest<{ tools: unknown[] }>('/api/tools');
  },

  execute: (toolId: string, args: Record<string, unknown>) => {
    return apiRequest<{ result: unknown }>(`/api/tools/${toolId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ arguments: args }),
    });
  },
};
