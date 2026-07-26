FROM node:24-alpine AS build
WORKDIR /app

RUN corepack enable pnpm

COPY src/dashboard/package.json src/dashboard/pnpm-lock.yaml src/dashboard/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY src/dashboard/ .
RUN pnpm build

FROM nginxinc/nginx-unprivileged:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY src/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
