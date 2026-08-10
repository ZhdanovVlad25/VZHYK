FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
RUN npm install --workspace=apps/web

FROM base AS dev
WORKDIR /app/apps/web
COPY apps/web ./
CMD ["npm", "run", "dev"]

FROM base AS build
COPY apps/web ./apps/web
RUN npm run build --workspace=apps/web

FROM node:20-alpine AS production
WORKDIR /app/apps/web
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next ./.next
COPY --from=build /app/apps/web/node_modules ./node_modules
COPY --from=build /app/apps/web/package.json ./package.json
COPY --from=build /app/apps/web/public ./public
EXPOSE 3000
CMD ["npm", "run", "start"]
