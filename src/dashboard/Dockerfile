FROM node:24-alpine AS build
WORKDIR /app

RUN corepack enable pnpm

COPY src/dashboard/package.json src/dashboard/pnpm-lock.yaml src/dashboard/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY src/dashboard/ .
RUN pnpm build

FROM nginxinc/nginx-unprivileged:alpine AS runtime

# Root only for the two lines below, back to the image's own user right after.
# openssl: floored to the CVE-2026-14456 fix, which Alpine ships and the base image does not yet.
# libexpat: same, floored to the CVE-2026-66046 and CVE-2026-76641 fix.
# curl: dropped with its dependency chain. Nothing here calls it, the healthcheck uses busybox
# wget, and a package that is not shipped never needs patching again.
USER root
RUN apk add --no-cache 'libcrypto3>=3.5.8-r0' 'libssl3>=3.5.8-r0' 'libexpat>=2.8.4-r0' \
	&& apk del curl
USER 101

COPY --from=build /app/dist /usr/share/nginx/html
COPY src/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
	CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1
