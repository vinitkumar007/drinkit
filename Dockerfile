# Drinkit has zero npm dependencies; it only needs Node 22.5+ (built-in SQLite).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DB_FILE=/data/drinkit.db
COPY package.json ./
COPY server ./server
COPY web ./web
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "--no-warnings", "server/index.js"]
