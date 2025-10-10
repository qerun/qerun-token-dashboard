# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache python3 make g++ && npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# Final stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Copy server runtime file directly from source context
COPY server.js ./server.js
EXPOSE 8080
CMD ["node", "server.js"]