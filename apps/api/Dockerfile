FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace=apps/api

FROM base AS dev
WORKDIR /app/apps/api
COPY apps/api ./
CMD ["npm", "run", "dev"]

FROM base AS build
COPY apps/api ./apps/api
RUN npm run build --workspace=apps/api

FROM node:20-alpine AS production
WORKDIR /app/apps/api
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./package.json
EXPOSE 3001
CMD ["node", "dist/main.js"]
