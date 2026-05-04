export async function frappeRequest(path: string, options: RequestInit = {}) {
  // If running on the client, use the local proxy to avoid CORS
  const isClient = typeof window !== 'undefined';
  const baseUrl = isClient ? '' : process.env.NEXT_PUBLIC_FRAPPE_URL;
  
  // Update path for proxy if on client
  const finalPath = isClient ? `/api/frappe${path.replace('/api', '')}` : path;
  const url = `${baseUrl}${finalPath}`;
  
  const headers: any = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  // Only add Auth header on the server side (proxy handles it on client)
  if (!isClient) {
    headers['Authorization'] = `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function frappeLogin(usr: string, pwd: string) {
  // Login also goes through proxy on client
  return frappeRequest('/api/method/login', {
    method: 'POST',
    body: JSON.stringify({ usr, pwd })
  });
}
