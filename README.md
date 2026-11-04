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
   docker run -p 3000:3000 obsidian-scripts-server
   ```

The server will be accessible at `http://localhost:3000`.

## Environment Variables/Secrets

Regardless of npm or docker you'll need to populate these env vars:

```
ADMIN_PASSWORD=
REDDIT_AUTH=
REDDIT_DEVICE_ID=
REDDIT_USER_AGENT=
```

You'll also need to create `src/fitbit_refresh_token.secret` and populate it with a Fitbit API refresh token. You can use the following webpage to get one: https://dev.fitbit.com/build/reference/web-api/troubleshooting-guide/oauth2-tutorial/

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
  build:
    context: /home/rooday/obsidian-scripts-server
  container_name: obsidian-script-server
  networks:
    - private
  environment:
    - PUID=1000
    - PGID=1000
    - TZ=America/Los_Angeles
  volumes:
    - /home/rooday/obsidian-scripts-server/.env:/usr/src/app/.env
    - /home/rooday/obsidian-scripts-server/src/fitbit_refresh_token.secret:/usr/src/app/src/fitbit_refresh_token.secret
  restart: always
  labels:
    - traefik.enable=true
    - traefik.http.routers.oss.rule=Host(`oss.domain.com`)
    - traefik.http.services.oss.loadbalancer.server.port=3000
    - traefik.http.routers.oss.entrypoints=websecure
    - traefik.http.routers.oss.tls.certresolver=cloudflare
```
