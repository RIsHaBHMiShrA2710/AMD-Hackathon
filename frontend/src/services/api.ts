const BASE_URL = 'http://localhost:8000/api/v1';

export interface Item {
  id: number;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ItemCreate {
  title: string;
  description?: string;
  status?: string;
}

export interface ItemUpdate {
  title?: string;
  description?: string;
  status?: string;
}

export interface HealthStatus {
  status: string;
  database: string;
  items_count: number;
  latency_ms: number;
  environment: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.detail || `Server responded with ${response.status}`);
    }

    return await response.json() as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network communication error');
  }
}

export const api = {
  getHealth: () => request<HealthStatus>('/health'),
  getItems: () => request<Item[]>('/items/'),
  getItem: (id: number) => request<Item>(`/items/${id}`),
  createItem: (item: ItemCreate) => request<Item>('/items/', {
    method: 'POST',
    body: JSON.stringify(item),
  }),
  updateItem: (id: number, item: ItemUpdate) => request<Item>(`/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(item),
  }),
  deleteItem: (id: number) => request<Item>(`/items/${id}`, {
    method: 'DELETE',
  }),
};
export default api;
