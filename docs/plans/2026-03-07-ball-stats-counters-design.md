# Ball Stats Counters Design

## Goal

Show ball interaction counters (total nudges + total returns) as a hidden easter egg that reveals itself when users first nudge the bouncing ball. Local clicks increment instantly; server-side totals provide the global count.

## Architecture

### Components

1. **AWS Lambda (Node.js)** — Holds `POSTHOG_API_KEY` as an environment variable. Queries PostHog's HogQL API for `ball_nudged` and `ball_returned_to_socket` event counts. In-memory cache (5 min TTL) so warm invocations skip the PostHog round-trip.

2. **CloudFront distribution** — Custom domain `api.joelmgallant.com`, ACM cert (us-east-1), caches Lambda response for 5 minutes at the edge. CORS allows `https://joelmgallant.com`.

3. **Route 53** — A alias record pointing `api.joelmgallant.com` to the CloudFront distribution.

4. **Client-side JS** (`layouts/index.html`) — On first nudge: fade in counter near socket, fetch server counts, count-up animate from 0, then instant local increments on each subsequent nudge/return. Gracefully hides counter if fetch fails.

### Data Flow

```
User nudges ball -> localNudges++ (instant UI update)
                 -> posthog.capture('ball_nudged') (fire and forget)

On first nudge -> fetch('https://api.joelmgallant.com/ball-stats')
              -> { nudges: 1247, returns: 892 }
              -> display: serverNudges + localNudges, serverReturns + localReturns
```

Other visitors' clicks are up to ~5 min stale (edge cache + PostHog ingestion). The user's own clicks are instant.

### AWS Resources

All under `--profile personal` (account `622206739165`):

- Lambda function with Function URL (no API Gateway needed)
- CloudFront distribution with custom domain
- ACM certificate for `api.joelmgallant.com` (us-east-1)
- Route 53 A alias record

### UI

- Counter appears near the ball socket (upper-right corner) only after first nudge
- Two lines: "nudged X times" / "made it home Y times"
- Style: small (0.75em), uppercase, letter-spaced, muted (#999)
- Fade-in on first reveal, count-up animation from 0 to server value
- Subsequent local interactions increment instantly

### Error Handling

- If the fetch fails or returns null, the counter stays hidden
- Lambda returns stale cached value if PostHog is unreachable
- No retry logic on the client — one fetch attempt on first nudge

### PostHog Query

HogQL via `POST https://us.posthog.com/api/projects/:project_id/query/`:

```sql
SELECT
  countIf(event = 'ball_nudged') as nudges,
  countIf(event = 'ball_returned_to_socket') as returns
FROM events
WHERE event IN ('ball_nudged', 'ball_returned_to_socket')
```

Authenticated with personal API key stored as Lambda env var.
