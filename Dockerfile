# syntax=docker/dockerfile:1

# Playwright's official image, pinned to the exact playwright version in
# package-lock.json (1.62.1). It ships Chromium and every shared library that
# Chromium needs, pre-installed under /ms-playwright, so chromium.launch()
# resolves the executable with no path configuration on our side.
#
# IMPORTANT: when bumping playwright in package.json, bump this tag in the same
# commit. A version mismatch is exactly what produces
# "browserType.launch: Executable doesn't exist at ...".
FROM mcr.microsoft.com/playwright:v1.62.1-noble

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Dependencies first so a source-only change reuses this layer.
# better-sqlite3 is compiled/fetched here for this image's platform.
COPY package.json package-lock.json ./
RUN npm ci

# No-op when the base image already carries the matching Chromium build; a real
# download if a future playwright bump lands before the image tag is updated.
# Either way the browser is present in the image, never installed at runtime.
RUN npx playwright install chromium

COPY . .

RUN npm run build

# Mount point for the SQLite volume (DATABASE_PATH=/data/monitor.db on Railway).
# Creating it keeps a volume-less `docker run` working too.
RUN mkdir -p /data

ENV NODE_ENV=production

EXPOSE 3000

# Railway injects PORT; next start binds 0.0.0.0 so the proxy can reach it.
CMD ["sh", "-c", "npm start -- --hostname 0.0.0.0 --port ${PORT:-3000}"]
