FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
WORKDIR /app

RUN corepack enable pnpm

COPY src/dashboard/package.json src/dashboard/pnpm-lock.yaml src/dashboard/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY src/dashboard/ .
RUN pnpm build

FROM nginxinc/nginx-unprivileged:alpine@sha256:26b0bf6fbf07297983cb341998d79c831508787de26627dd2a112321b9c3a4af AS runtime

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
# pcre2: floored to the CVE-2026-103111 fix, which Alpine ships and the base image does not yet.
# curl: dropped with its dependency chain. Nothing here calls it, the healthcheck uses busybox
# wget, and a package that is not shipped never needs patching again.
USER root
RUN apk add --no-cache 'pcre2>=10.49-r0' \
	&& apk del curl
USER 101

COPY --from=build /app/dist /usr/share/nginx/html
COPY src/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
# 127.0.0.1, not localhost: busybox resolves localhost to ::1 and nginx listens on IPv4 only.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
	CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/ || exit 1
