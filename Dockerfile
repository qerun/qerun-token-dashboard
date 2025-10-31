# Build stage
FROM node:20-alpine AS build
ARG NODE_OPTIONS=--max_old_space_size=4096
ENV NODE_OPTIONS=${NODE_OPTIONS}
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache python3 make g++ && npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# Final stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=development
ENV PORT=8080
ENV CHAIN_ID=97
ENV STATE_MANAGER_ADDRESS=0xa622B3D86Ef65A7c7fd3723500CDDDF741F5E2e9
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Copy server runtime file directly from source context
COPY server.js ./server.js
EXPOSE 8080
CMD ["node", "server.js"]