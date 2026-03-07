let cache = { data: null, expiry: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://joelmgallant.com',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=300',
  };

  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const now = Date.now();

  // Return cached data if fresh
  if (cache.data && now < cache.expiry) {
    return { statusCode: 200, headers, body: JSON.stringify(cache.data) };
  }

  try {
    const projectId = process.env.POSTHOG_PROJECT_ID;
    const apiKey = process.env.POSTHOG_API_KEY;

    const response = await fetch(`https://us.posthog.com/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: {
          kind: 'HogQLQuery',
          query: `SELECT
            countIf(event = 'ball_nudged') as nudges,
            countIf(event = 'ball_returned_to_socket') as returns
          FROM events
          WHERE event IN ('ball_nudged', 'ball_returned_to_socket')`,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`PostHog API error: ${response.status}`);
    }

    const result = await response.json();
    // HogQL returns { results: [[nudges, returns]], columns: [...] }
    const row = result.results?.[0] || [0, 0];
    const data = { nudges: row[0] || 0, returns: row[1] || 0 };

    cache = { data, expiry: now + CACHE_TTL };

    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    console.error('Error querying PostHog:', err);

    // Return stale cache if available
    if (cache.data) {
      return { statusCode: 200, headers, body: JSON.stringify(cache.data) };
    }

    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ nudges: null, returns: null }),
    };
  }
}
