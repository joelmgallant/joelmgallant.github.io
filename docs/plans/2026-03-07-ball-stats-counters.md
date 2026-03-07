# Ball Stats Counters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show global ball interaction counters (nudges + returns) as a hidden easter egg, with instant local increments backed by a Lambda + CloudFront API.

**Architecture:** Lambda Function URL behind CloudFront queries PostHog HogQL for event counts. Client-side JS fetches counts on first nudge, renders near the socket, and increments locally for instant feedback.

**Tech Stack:** AWS Lambda (Node.js 20), CloudFront, ACM, Route 53, AWS CLI (`--profile personal`), PostHog HogQL API

**AWS Account:** `622206739165` (root, personal)
**Route 53 Hosted Zone:** `Z24LPQ8XNNWXU9` (`joelmgallant.com`)
**PostHog Project API Key:** `phc_plxiGuaXxj69Di9eJDJus38ZsEQzk9q8tiihqJDvyqR`

---

### Task 1: Create PostHog Personal API Key

**Context:** The HogQL query endpoint requires a personal API key (not the project key). You need to create one in the PostHog dashboard.

**Step 1: Create the key**

Go to PostHog > Settings > Personal API Keys > Create Personal API Key.
- Name: `ball-stats-lambda`
- Scopes: read-only (query access)

Save the key — you'll need it for Task 2.

**Step 2: Find your PostHog Project ID**

Go to PostHog > Settings > Project. Note the numeric project ID from the URL (e.g. `https://us.posthog.com/project/12345/settings` — the ID is `12345`).

---

### Task 2: Create and Deploy Lambda Function

**Context:** A Node.js Lambda function that queries PostHog's HogQL API for ball event counts, with in-memory caching.

**Files:**
- Create: `lambda/ball-stats/index.mjs`

**Step 1: Create the Lambda function code**

```javascript
// lambda/ball-stats/index.mjs
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
```

**Step 2: Package the Lambda**

```bash
cd lambda/ball-stats
zip -j ball-stats.zip index.mjs
```

**Step 3: Create IAM role for Lambda**

```bash
aws iam create-role \
  --role-name ball-stats-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }' \
  --profile personal
```

```bash
aws iam attach-role-policy \
  --role-name ball-stats-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
  --profile personal
```

Wait ~10 seconds for the role to propagate.

**Step 4: Create the Lambda function**

Replace `<POSTHOG_API_KEY>` and `<POSTHOG_PROJECT_ID>` with values from Task 1.

```bash
aws lambda create-function \
  --function-name ball-stats \
  --runtime nodejs20.x \
  --handler index.handler \
  --role arn:aws:iam::622206739165:role/ball-stats-lambda-role \
  --zip-file fileb://ball-stats.zip \
  --timeout 10 \
  --memory-size 128 \
  --environment 'Variables={POSTHOG_API_KEY=<POSTHOG_API_KEY>,POSTHOG_PROJECT_ID=<POSTHOG_PROJECT_ID>}' \
  --region us-east-1 \
  --profile personal
```

Save the returned `FunctionArn`.

**Step 5: Create Function URL**

```bash
aws lambda create-function-url-config \
  --function-name ball-stats \
  --auth-type NONE \
  --cors '{
    "AllowOrigins": ["https://joelmgallant.com"],
    "AllowMethods": ["GET", "OPTIONS"],
    "AllowHeaders": ["Content-Type"],
    "MaxAge": 86400
  }' \
  --region us-east-1 \
  --profile personal
```

Save the returned `FunctionUrl`.

**Step 6: Add public invoke permission for Function URL**

```bash
aws lambda add-permission \
  --function-name ball-stats \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region us-east-1 \
  --profile personal
```

**Step 7: Test the Function URL directly**

```bash
curl -s <FUNCTION_URL> | jq .
```

Expected: `{ "nudges": <number>, "returns": <number> }`

(Counts may be 0 if no events have been ingested yet — that's fine.)

**Step 8: Commit**

```bash
git add lambda/ball-stats/
git commit -m "Add ball-stats Lambda function for PostHog event counts"
```

---

### Task 3: Request ACM Certificate for api.joelmgallant.com

**Context:** CloudFront requires certs in `us-east-1`.

**Step 1: Request the certificate**

```bash
aws acm request-certificate \
  --domain-name api.joelmgallant.com \
  --validation-method DNS \
  --region us-east-1 \
  --profile personal
```

Save the returned `CertificateArn`.

**Step 2: Get DNS validation record**

```bash
aws acm describe-certificate \
  --certificate-arn <CERT_ARN> \
  --region us-east-1 \
  --profile personal \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'
```

If it returns `null`, wait a few seconds and retry.

**Step 3: Create Route 53 validation record**

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id Z24LPQ8XNNWXU9 \
  --profile personal \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "<CNAME_NAME>",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "<CNAME_VALUE>"}]
      }
    }]
  }'
```

**Step 4: Wait for validation**

```bash
aws acm wait certificate-validated \
  --certificate-arn <CERT_ARN> \
  --region us-east-1 \
  --profile personal
```

Expected: Certificate status changes to `ISSUED`.

---

### Task 4: Create CloudFront Distribution for API

**Context:** Single origin pointing to the Lambda Function URL. Caches responses for 5 minutes.

**Important:** The Lambda Function URL looks like `https://xxxxxxxxxx.lambda-url.us-east-1.on.aws/`. The origin domain is `xxxxxxxxxx.lambda-url.us-east-1.on.aws` (strip the `https://` and trailing `/`).

**Step 1: Create the distribution**

```bash
aws cloudfront create-distribution \
  --profile personal \
  --distribution-config '{
    "CallerReference": "ball-stats-api-2026-03-07",
    "Comment": "Ball stats API (Lambda) for joelmgallant.com",
    "Enabled": true,
    "Aliases": {
      "Quantity": 1,
      "Items": ["api.joelmgallant.com"]
    },
    "ViewerCertificate": {
      "ACMCertificateArn": "<CERT_ARN>",
      "SSLSupportMethod": "sni-only",
      "MinimumProtocolVersion": "TLSv1.2_2021"
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "ball-stats-lambda",
      "ViewerProtocolPolicy": "https-only",
      "AllowedMethods": {
        "Quantity": 3,
        "Items": ["GET", "HEAD", "OPTIONS"],
        "CachedMethods": {
          "Quantity": 2,
          "Items": ["GET", "HEAD"]
        }
      },
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
      "OriginRequestPolicyId": "b689b0a8-53d0-40ab-baf2-68738e2966ac",
      "Compress": true
    },
    "Origins": {
      "Quantity": 1,
      "Items": [{
        "Id": "ball-stats-lambda",
        "DomainName": "<LAMBDA_FUNCTION_URL_DOMAIN>",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "https-only",
          "OriginSslProtocols": {
            "Quantity": 1,
            "Items": ["TLSv1.2"]
          }
        }
      }]
    },
    "DefaultRootObject": "",
    "HttpVersion": "http2and3",
    "IsIPV6Enabled": true,
    "PriceClass": "PriceClass_100"
  }'
```

Save the returned `DomainName` (e.g. `dxxxxxxxxx.cloudfront.net`) and `Id`.

**Step 2: Wait for distribution to deploy**

```bash
aws cloudfront wait distribution-deployed \
  --id <DISTRIBUTION_ID> \
  --profile personal
```

Takes 5-15 minutes.

---

### Task 5: Create Route 53 Alias Record

**Context:** Point `api.joelmgallant.com` to the CloudFront distribution.

**Step 1: Create the alias record**

CloudFront hosted zone ID is always `Z2FDTNDATAQYW2`.

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id Z24LPQ8XNNWXU9 \
  --profile personal \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.joelmgallant.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "<CLOUDFRONT_DOMAIN>",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

**Step 2: Verify end-to-end**

```bash
curl -s https://api.joelmgallant.com/ball-stats | jq .
```

Expected: `{ "nudges": <number>, "returns": <number> }`

---

### Task 6: Add Client-Side Counter UI

**Files:**
- Modify: `layouts/index.html:162-177` (CSS)
- Modify: `layouts/index.html:991-1001` (nudgeBall tracking)
- Modify: `layouts/index.html:818-819` (return tracking)

**Step 1: Add counter CSS**

In `layouts/index.html`, add before the closing `</style>` tag (before line 177):

```css
      /* Ball stats counter */
      #ball-stats {
        position: absolute;
        top: 52px;
        right: 20px;
        z-index: 11;
        text-align: right;
        font-size: 0.7em;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #999;
        opacity: 0;
        transition: opacity 0.6s ease-in-out;
        pointer-events: none;
        line-height: 1.6;
      }

      #ball-stats.visible {
        opacity: 1;
      }
```

**Step 2: Add counter HTML**

In `layouts/index.html`, right after the `<canvas id="physics-canvas"></canvas>` line (line 181):

```html
      <div id="ball-stats">
        <div>nudged <span id="ball-nudge-count">0</span> times</div>
        <div>made it home <span id="ball-return-count">0</span> times</div>
      </div>
```

**Step 3: Add counter JS logic**

In `layouts/index.html`, in the `<script>` block, right after the ball state variables (after `let nudgeTime = 0;` at line 704), add:

```javascript
        // Ball stats counter state
        let serverNudges = 0;
        let serverReturns = 0;
        let localNudges = 0;
        let localReturns = 0;
        let statsFetched = false;
        let statsVisible = false;
        const statsEl = document.getElementById('ball-stats');
        const nudgeCountEl = document.getElementById('ball-nudge-count');
        const returnCountEl = document.getElementById('ball-return-count');

        function updateStatsDisplay() {
          nudgeCountEl.textContent = (serverNudges + localNudges).toLocaleString();
          returnCountEl.textContent = (serverReturns + localReturns).toLocaleString();
        }

        function animateCountUp(target, el, duration) {
          const start = performance.now();
          const step = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            el.textContent = Math.floor(progress * target).toLocaleString();
            if (progress < 1) requestAnimationFrame(step);
            else el.textContent = target.toLocaleString();
          };
          requestAnimationFrame(step);
        }

        function showStats() {
          if (statsVisible) return;
          statsVisible = true;
          statsEl.classList.add('visible');
        }

        function fetchBallStats() {
          if (statsFetched) return;
          statsFetched = true;
          fetch('https://api.joelmgallant.com/ball-stats')
            .then(r => r.ok ? r.json() : Promise.reject('fetch failed'))
            .then(data => {
              if (data.nudges != null && data.returns != null) {
                serverNudges = data.nudges;
                serverReturns = data.returns;
                // Count-up animate server values, then add local offset
                animateCountUp(serverNudges + localNudges, nudgeCountEl, 1200);
                animateCountUp(serverReturns + localReturns, returnCountEl, 1200);
                showStats();
              }
            })
            .catch(() => {
              // If fetch fails and user has local interactions, show those
              if (localNudges > 0) {
                updateStatsDisplay();
                showStats();
              }
            });
        }
```

**Step 4: Wire up local nudge increment**

In the `nudgeBall` function, right after the existing PostHog tracking block (after line 1001), add:

```javascript
            // Local counter increment
            localNudges++;
            if (statsVisible) updateStatsDisplay();
            fetchBallStats();
```

**Step 5: Wire up local return increment**

In the homing/docking section, right after the `posthog.capture('ball_returned_to_socket');` line (after line 819), add:

```javascript
              // Local counter increment
              localReturns++;
              if (statsVisible) updateStatsDisplay();
```

**Step 6: Test locally**

```bash
hugo server
```

- Open `http://localhost:1313`
- Click near the ball to nudge it
- Verify counter appears near the socket after first nudge
- Verify nudge count increments on each click
- Wait for ball to return home, verify return count increments
- Check browser console for no errors
- Check network tab for `api.joelmgallant.com/ball-stats` request

**Step 7: Commit**

```bash
git add layouts/index.html
git commit -m "Add ball stats counter UI with optimistic local increments"
```

---

### Verification Checklist

- [ ] PostHog personal API key created with read-only scope
- [ ] Lambda function deployed and returning counts via Function URL
- [ ] ACM certificate issued for `api.joelmgallant.com`
- [ ] CloudFront distribution deployed
- [ ] `api.joelmgallant.com` resolves to CloudFront
- [ ] `curl https://api.joelmgallant.com/ball-stats` returns JSON with nudges/returns
- [ ] Counter hidden on page load (no counter visible until first nudge)
- [ ] Counter appears with fade-in and count-up animation after first nudge
- [ ] Each nudge immediately increments the nudge counter
- [ ] Ball returning to socket immediately increments the return counter
- [ ] Counter survives page navigation (re-fetches on next visit)
- [ ] No errors in browser console
