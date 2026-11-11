// Client for the exchange API (AWS Lambda function URL).
export const API_URL = 'https://2etmatfpkhkso64i3jfuychdsa0cmkeu.lambda-url.ca-central-1.on.aws';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function createApi(key, baseUrl = API_URL) {
  async function call(method, path, body) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${key}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(response.status, data.error ?? `HTTP ${response.status}`);
    return data;
  }

  return {
    whoami: () => call('GET', '/whoami'),
    get: (date) => call('GET', `/exchange?date=${date}`),
    put: (date, answer) => call('PUT', `/exchange?date=${date}`, answer),
    history: (before) => call('GET', `/history?before=${before}`),
    game: (date) => call('GET', `/game?date=${date}`),
    putGame: (date, answer) => call('PUT', `/game?date=${date}`, answer),
    guess: (date, guess) => call('PUT', `/game/guess?date=${date}`, { guess }),
    rule: (date, ruling) => call('PUT', `/game/ruling?date=${date}`, { ruling }),
    /** Uploads a blob through a presigned POST and returns its storage key. round: 'game' for Bonus Round media. */
    async upload(date, kind, blob, contentType, round = null) {
      const form = await call('POST', `/upload?date=${date}&kind=${kind}${round ? `&round=${round}` : ''}`, { contentType });
      const data = new FormData();
      for (const [name, value] of Object.entries(form.fields)) data.append(name, value);
      data.append('file', blob);
      const response = await fetch(form.url, { method: 'POST', body: data });
      if (!response.ok) throw new ApiError(response.status, response.status === 400 ? 'That file is too big.' : 'Upload failed.');
      return form.key;
    },
  };
}
