export async function readResponseJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function readResponseError(
  response: Response,
  payload: { error?: string } | null,
  fallback: string
) {
  if (payload?.error && payload.error.trim().length > 0) {
    return payload.error;
  }
  if (!response.ok) {
    return `${fallback} (HTTP ${response.status})`;
  }
  return fallback;
}
