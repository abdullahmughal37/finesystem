FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/
COPY index.html postcss.config.mjs vite.config.ts ./
COPY src ./src
RUN npm ci

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
RUN npm --prefix server ci --omit=dev && npm cache clean --force

COPY server ./server
COPY --from=frontend-build /app/dist ./dist

EXPOSE 5000
CMD ["node", "server/server.js"]
