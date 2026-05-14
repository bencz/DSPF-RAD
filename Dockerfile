# Lightweight static-file server for DSPF·RAD.
# Uses `serve` so the container honours Railway's dynamic $PORT without
# any nginx config gymnastics.
FROM node:lts-alpine

WORKDIR /app

RUN npm install -g serve@latest --silent

# Copy only the runtime assets. The project is fully static: HTML, CSS,
# the ES module tree under src/, plus the SEO helpers (robots.txt and
# sitemap.xml) so crawlers can find their way around.
COPY index.html styles.css robots.txt sitemap.xml ./
COPY src/ ./src/

# Railway injects PORT at runtime; 8080 is just the local default.
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "serve --no-clipboard . -l tcp://0.0.0.0:${PORT}"]
