FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages ./packages
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
WORKDIR /app
ENV NODE_ENV=production
# npm workspaces хоїстить частину залежностей (напр. reflect-metadata) у корінь /app/node_modules —
# Node резолвить модулі, ходячи вгору по батьківських node_modules, тож потрібні обидва рівні.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
