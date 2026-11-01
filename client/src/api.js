export async function api(path, { method = 'GET', body, formData } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'include',
      headers: (formData || body == null) ? undefined : { 'Content-Type': 'application/json' },
      body: formData || (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new Error('The server did not respond. Try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'Request failed.');
    error.status = response.status;
    error.errors = data.errors || {};
    error.retryAfter = data.retryAfter;
    throw error;
  }
  return data;
}
