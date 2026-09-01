FROM node:24-alpine AS build
WORKDIR /app

RUN corepack enable pnpm

COPY src/dashboard/package.json src/dashboard/pnpm-lock.yaml src/dashboard/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY src/dashboard/ .
RUN pnpm build

FROM nginxinc/nginx-unprivileged:alpine AS runtime

# The revision is the one thing an operator cannot recover from the image otherwise: a version tag
# is a name someone chose, a commit is what actually built. Defaults keep a local build working.
ARG VYZIO_VERSION=0.0.0-dev
ARG VYZIO_REVISION=unknown
LABEL org.opencontainers.image.title="Vyzio dashboard"
LABEL org.opencontainers.image.description="Privacy-first home video surveillance with local AI: web interface."
LABEL org.opencontainers.image.url="https://github.com/KelianS/vyzio"
LABEL org.opencontainers.image.source="https://github.com/KelianS/vyzio"
LABEL org.opencontainers.image.licenses="AGPL-3.0-only"
LABEL org.opencontainers.image.version="${VYZIO_VERSION}"
LABEL org.opencontainers.image.revision="${VYZIO_REVISION}"

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
