FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY apps/web/package.json apps/web/package.json
RUN npm install --workspace=apps/web

FROM base AS dev
WORKDIR /app/apps/web
COPY apps/web ./
CMD ["npm", "run", "dev"]

FROM base AS build
# NEXT_PUBLIC_* вшиваються в клієнтський бандл САМЕ під час build, не читаються в рантаймі —
# Railway підставляє service-змінні як build args лише для тих, що явно оголошені тут через
# ARG (Dockerfile-білди, на відміну від Nixpacks, не інжектять їх автоматично).
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
COPY apps/web ./apps/web
RUN npm run build --workspace=apps/web

# output: 'standalone' (next.config.js) трасує лише реально потрібні залежності —
# набагато менший runtime-образ, ніж копіювання повного node_modules.
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
