/**
 * One-time helper to obtain a Google OAuth refresh token for the Google
 * Health API and store it in .env.
 *
 *   npm run google:auth            # prints the consent URL
 *   npm run google:auth -- <code>  # exchanges the code and saves the token
 *
 * Secrets are never printed.
 */
import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import fetch from "node-fetch";

const SCOPE = "https://www.googleapis.com/auth/googlehealth.sleep.readonly";
const REDIRECT_URI = "https://www.google.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ENV_PATH = path.resolve(process.cwd(), ".env");

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env.\n" +
      "Copy client_id and client_secret from the downloaded client secret JSON."
  );
  process.exit(1);
}

const code = process.argv[2]?.trim();

if (!code) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", SCOPE);

  console.log("Open this URL in your browser, sign in, and approve access:\n");
  console.log(url.toString());
  console.log(
    "\nAfter approving you will be redirected to https://www.google.com/?code=...\n" +
      "Copy the code value and run:\n\n" +
      "  npm run google:auth -- \"<code>\"\n"
  );
  process.exit(0);
}

const response = await fetch(TOKEN_URL, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  }),
});

const data = await response.json();

if (!response.ok) {
  console.error(`Token exchange failed (HTTP ${response.status}).`);
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

if (!data.refresh_token) {
  console.error(
    "The response did not include a refresh_token. Re-run the consent step\n" +
      "and make sure prompt=consent and access_type=offline are in the URL."
  );
  process.exit(1);
}

let existing = "";
try {
  existing = await fs.readFile(ENV_PATH, "utf8");
} catch {
  // .env does not exist yet
}

const line = `GOOGLE_REFRESH_TOKEN=${data.refresh_token}`;
const lines = existing.split(/\r?\n/);
const index = lines.findIndex((l) => l.startsWith("GOOGLE_REFRESH_TOKEN="));

if (index >= 0) {
  lines[index] = line;
} else {
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  lines.push(line);
}

await fs.writeFile(ENV_PATH, `${lines.join("\n")}\n`, "utf8");

console.log("Refresh token saved to .env");
console.log(`  expires_in:                 ${data.expires_in}`);
console.log(
  `  refresh_token_expires_in:   ${
    data.refresh_token_expires_in ?? "absent (long-lived)"
  }`
);
console.log(`  scopes:                     ${data.scope}`);
