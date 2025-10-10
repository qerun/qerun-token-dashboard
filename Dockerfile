FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
# Toolchain for node-gyp builds (bufferutil, etc.)
RUN apk add --no-cache python3 make g++ && npm ci

COPY . .
# Inject Vite build-time env (set via --build-arg or Cloud Build substitutions)
ARG VITE_STATE_MANAGER_ADDRESS
ARG VITE_CHAIN_ID
ARG VITE_CHAIN_RPC_URL
ARG VITE_CHAIN_EXPLORER_URL
ARG VITE_WALLETCONNECT_PROJECT_ID
ENV VITE_STATE_MANAGER_ADDRESS=${VITE_STATE_MANAGER_ADDRESS}
ENV VITE_CHAIN_ID=${VITE_CHAIN_ID}
ENV VITE_CHAIN_RPC_URL=${VITE_CHAIN_RPC_URL}
ENV VITE_CHAIN_EXPLORER_URL=${VITE_CHAIN_EXPLORER_URL}
ENV VITE_WALLETCONNECT_PROJECT_ID=${VITE_WALLETCONNECT_PROJECT_ID}
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
