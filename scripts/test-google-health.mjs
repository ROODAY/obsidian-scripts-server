/**
 * Read-only smoke test for the Google Health API using the credentials in
 * .env. Prints diagnostics only (statuses, field names, booleans), never
 * tokens or health values.
 *
 *   npm run google:test            # uses yesterday
 *   npm run google:test -- 2026-11-02
 */
import "dotenv/config";
import fetch from "node-fetch";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://health.googleapis.com/v4";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

if (!clientId || !clientSecret || !refreshToken) {
  console.error(
    "Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN in .env."
  );
  process.exit(1);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

const date = process.argv[2]?.trim() || isoDate(new Date(Date.now() - 86400000));
const nextDate = isoDate(
  new Date(Date.parse(`${date}T00:00:00Z`) + 86400000)
);

console.log(`Testing Google Health API for ${date} → ${nextDate}\n`);

// 1. Refresh the access token.
const tokenResponse = await fetch(TOKEN_URL, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }),
});

const token = await tokenResponse.json();

console.log(`token refresh: HTTP ${tokenResponse.status}`);
if (!tokenResponse.ok) {
  console.error(JSON.stringify(token, null, 2));
  process.exit(1);
}
console.log(`  expires_in:                ${token.expires_in} seconds`);
console.log(
  `  refresh_token_expires_in:  ${
    token.refresh_token_expires_in ?? "absent (long-lived)"
  }`
);
console.log(`  scopes:                    ${token.scope}`);

const headers = {
  Authorization: `Bearer ${token.access_token}`,
  Accept: "application/json",
};

// 2. Confirm the Google Health account is linked.
const identityResponse = await fetch(`${API_BASE}/users/me/identity`, {
  headers,
});
const identity = await identityResponse.json();

console.log(`\nidentity: HTTP ${identityResponse.status}`);
if (identityResponse.ok) {
  console.log(`  legacyUserId present:  ${Boolean(identity.legacyUserId)}`);
  console.log(`  healthUserId present:  ${Boolean(identity.healthUserId)}`);
} else {
  console.log(`  error: ${JSON.stringify(identity)}`);
  if (identity?.error?.details?.some?.((d) => d.reason === "ACCOUNT_NOT_LINKED")) {
    console.log(
      "  → open the Google Health app, sign in, and migrate the Fitbit profile."
    );
  }
}

// 3. List sleep sessions for the date.
const url = new URL(`${API_BASE}/users/me/dataTypes/sleep/dataPoints`);
url.searchParams.set("pageSize", "25");
url.searchParams.set(
  "filter",
  `sleep.interval.civil_end_time >= "${date}" AND sleep.interval.civil_end_time < "${nextDate}"`
);

const sleepResponse = await fetch(url, { headers });
const sleep = await sleepResponse.json();
const points = Array.isArray(sleep.dataPoints) ? sleep.dataPoints : [];

console.log(`\nsleep: HTTP ${sleepResponse.status}`);
if (!sleepResponse.ok) {
  console.log(`  error: ${JSON.stringify(sleep)}`);
  process.exit(1);
}

console.log(`  data points:     ${points.length}`);
console.log(`  nextPageToken:   ${Boolean(sleep.nextPageToken)}`);
console.log(
  `  main sleep:      ${
    points.some((p) => p.sleep?.metadata?.mainSleep === true) ? "yes" : "no"
  }`
);

points.forEach((point, index) => {
  const session = point.sleep ?? {};
  const summary = session.summary ?? {};
  const metadata = session.metadata ?? {};

  console.log(`\n  point ${index + 1}`);
  console.log(`    type:            ${session.type ?? "missing"}`);
  console.log(`    start/end:       ${Boolean(session.interval?.startTime)}/${Boolean(session.interval?.endTime)}`);
  console.log(`    utc offsets:     ${Boolean(session.interval?.startUtcOffset)}/${Boolean(session.interval?.endUtcOffset)}`);
  console.log(`    stages:          ${Array.isArray(session.stages) ? session.stages.length : 0}`);
  console.log(
    `    summary fields:  ${Object.keys(summary).join(", ") || "none"}`
  );
  console.log(
    `    metadata flags:  mainSleep=${metadata.mainSleep === true}, nap=${
      metadata.nap === true
    }, processed=${metadata.processed === true}, stagesStatus=${
      metadata.stagesStatus ?? "missing"
    }`
  );
});

if (points.length === 0) {
  console.log(
    "\nNo sessions on that date. Try another date with `npm run google:test -- YYYY-MM-DD`."
  );
}
