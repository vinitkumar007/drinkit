// JSON API client. One instance per app so each app keeps its own login (customer / admin / rider).
export function createApi(session) {
  async function request(method, url, body) {
    let res;
    try {
      res = await fetch('/api' + url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(session.token ? { Authorization: 'Bearer ' + session.token } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('Server se connect nahi ho pa raha. Internet check karo.', 0);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && session.token) session.expire();
    if (!res.ok) throw new ApiError(data.error || 'Kuch galat ho gaya', res.status);
    return data;
  }
  return {
    get: (u) => request('GET', u),
    post: (u, b = {}) => request('POST', u, b),
    patch: (u, b = {}) => request('PATCH', u, b),
    del: (u) => request('DELETE', u),
  };
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
