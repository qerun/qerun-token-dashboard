FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
# Toolchain for node-gyp builds (bufferutil, etc.)
RUN apk add --no-cache python3 make g++ && npm ci

COPY . .
# Accept Vite build-time variables via build args and expose as ENV for the build
ARG VITE_STATE_MANAGER_ADDRESS
ARG VITE_CHAIN_ID
ENV VITE_STATE_MANAGER_ADDRESS=$VITE_STATE_MANAGER_ADDRESS
ENV VITE_CHAIN_ID=$VITE_CHAIN_ID

RUN npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js

EXPOSE 8080
CMD ["node", "server.js"]
