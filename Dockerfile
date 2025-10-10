FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
# Toolchain for node-gyp builds (bufferutil, etc.)
RUN apk add --no-cache python3 make g++ && npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV VITE_STATE_MANAGER_ADDRESS=0x1C6C9E256808dDaAe723E917cE700fDE3Ce1B73A
ENV VITE_CHAIN_ID=11155111

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js

EXPOSE 8080
CMD ["node", "server.js"]
