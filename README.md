# Obsidian Scripts Server

Simple dockerized web server that wraps scripts that don't run well inside Obsidian, that I use within Templater templates. Uses HTTP Basic auth, username is admin, password is configured via environment variables.

## Setup Instructions

1. **Clone the repository:**

   ```
   git clone <repository-url>
   cd obsidian-scripts-server
   ```

2. **Install dependencies:**

   ```
   npm install
   ```

3. **Run the server:**

   ```
   node src/server.js
   ```

   The server will start on `http://localhost:3000`.

## Docker

To build and run the Docker container:

1. **Build the Docker image:**

   ```
   docker build -t obsidian-scripts-server .
   ```

2. **Run the Docker container:**
   ```
   docker run -p 3000:3000 --env-file .env obsidian-scripts-server
   ```

The server will be accessible at `http://localhost:3000`.

### Prebuilt images

GitHub Actions (`.github/workflows/docker.yml`) builds the image and publishes
it to `ghcr.io/rooday/obsidian-scripts-server`:

| Trigger | Tags |
| --- | --- |
| Push a `vX.Y.Z` tag | `X.Y.Z`, `X.Y`, `X`, `latest` |
| Push to `main` | `main`, `sha-<short>` |
| Pull request | built to check it, not pushed |

To release, bump `version` in `package.json`, then tag and push:

```
git tag v1.2.3
git push origin v1.2.3
```

Deployments should pin an exact version (`:1.2.3`) rather than `latest`.

## Environment Variables/Secrets

Regardless of npm or docker you'll need to populate these env vars:

```
ADMIN_PASSWORD=
REDDIT_AUTH=
REDDIT_DEVICE_ID=
REDDIT_USER_AGENT=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
```

`.env` is gitignored. The downloaded OAuth client JSON (`client_secret_*.json`)
and `secrets.json` are also ignored — do not commit either.

### Google Health API credentials

The sleep endpoint uses the Google Health API (the Fitbit Web API was shut
down in November 2026), which uses Google OAuth 2.0.

One-time Google Cloud setup:

1. Create a Google Cloud project and enable the **Google Health API**.
2. Create an OAuth client of type **Web application** with the redirect URI
   `https://www.google.com`, then download its client secret JSON.
3. On the OAuth consent screen, add the
   `https://www.googleapis.com/auth/googlehealth.sleep.readonly` scope and
   publish the app to **Production**. Apps left in **Testing** issue refresh
   tokens that expire after 7 days. Verification is not required for personal
   use; the unverified-app warning can be clicked through.
4. Complete the branding fields using the GitHub Pages URLs described in
   [OAuth consent branding](#oauth-consent-branding-github-pages).

Then copy `client_id` and `client_secret` from the downloaded client secret
JSON into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and run:

```
npm run google:auth
```

Open the printed URL, sign in with the account that has a Google Health
profile, and approve the `googlehealth.sleep.readonly` scope. You will see an
"unverified app" warning; choose **Advanced → proceed**. Google redirects to
`https://www.google.com/?code=...`; copy the code and run:

```
npm run google:auth -- "<code>"
```

This exchanges the code and writes `GOOGLE_REFRESH_TOKEN` into `.env` without
printing it. The script reports whether the token is long-lived
(`refresh_token_expires_in` absent).

Verify the credentials with:

```
npm run google:test
npm run google:test -- 2026-11-02
```

The test prints only diagnostics — token expiry, account link status, and the
shape of each sleep data point (no tokens or health values).

#### Re-authenticating

`GOOGLE_REFRESH_TOKEN` stays valid as long as it is used at least once every
six months and access has not been revoked. If it stops working — access was
revoked, the token went unused, or the OAuth client was recreated — repeat the
`npm run google:auth` steps above, then update `GOOGLE_REFRESH_TOKEN` in the
`.env` used by the server.

## OAuth consent branding (GitHub Pages)

The static pages in `docs/` are the home page, privacy policy, and terms of
service used by the Google OAuth consent screen. To publish them:

1. Go to **Settings → Pages** in the GitHub repository.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose branch **main** and folder **/docs**, then save.

Once published, enter these values in the Google Cloud console under
**Google Auth Platform → Branding**:

| Field | Value |
| --- | --- |
| Application home page | `https://rooday.github.io/obsidian-scripts-server/` |
| Application privacy policy link | `https://rooday.github.io/obsidian-scripts-server/privacy.html` |
| Application terms of service link | `https://rooday.github.io/obsidian-scripts-server/terms.html` |
| Authorized domains | `rooday.github.io` |

Leave **App logo** empty — uploading a logo requires the app to go through
verification.

## Docker Compose

Here's an example docker compose section using Traefik as a reverse-proxy:

```yaml
obsidian-script-server:
  image: ghcr.io/rooday/obsidian-scripts-server:1.0.0
  container_name: obsidian-script-server
  networks:
    - private
  environment:
    - PUID=1000
    - PGID=1000
    - TZ=America/Los_Angeles
  volumes:
    - /home/rooday/obsidian-scripts-server/.env:/usr/src/app/.env
  restart: always
  labels:
    - traefik.enable=true
    - traefik.http.routers.oss.rule=Host(`oss.domain.com`)
    - traefik.http.services.oss.loadbalancer.server.port=3000
    - traefik.http.routers.oss.entrypoints=websecure
    - traefik.http.routers.oss.tls.certresolver=cloudflare
```
