# Production image for the IFT 458 Level 1 app.
# Small, reproducible, and it runs as a non-root user.
FROM node:22-alpine

WORKDIR /app

# Copy the manifests first: this layer is cached until dependencies change,
# so code edits rebuild in seconds instead of re-installing everything.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Never run a web server as root
RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /app/logs && chown -R app:app /app
USER app

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
