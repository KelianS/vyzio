FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

COPY src/vyzio/Vyzio.Core/Vyzio.Core.csproj               ./src/vyzio/Vyzio.Core/Vyzio.Core.csproj
COPY src/vyzio/Vyzio.Application/Vyzio.Application.csproj ./src/vyzio/Vyzio.Application/Vyzio.Application.csproj
COPY src/vyzio/Vyzio.Infrastructure/Vyzio.Infrastructure.csproj ./src/vyzio/Vyzio.Infrastructure/Vyzio.Infrastructure.csproj
COPY src/vyzio/Vyzio.Api/Vyzio.Api.csproj                 ./src/vyzio/Vyzio.Api/Vyzio.Api.csproj
RUN dotnet restore ./src/vyzio/Vyzio.Api/Vyzio.Api.csproj

COPY src/vyzio ./src/vyzio
RUN dotnet publish ./src/vyzio/Vyzio.Api/Vyzio.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app

# docker-cli: restart Frigate on config apply
# tzdata: IANA timezone database (Europe/Paris, etc.)
# icu-libs: .NET globalization — disabled by default in Alpine-based images
# curl: fetch bundled detection models at build time (below)
RUN apk add --no-cache docker-cli tzdata icu-libs su-exec curl

ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

# YOLOX (Apache-2.0) pretrained ONNX model, Openvino/Intel-GPU tier only — installed into Frigate's
# shared config volume on demand by IFrigateModelAssetInstaller (ADR-34). Apache-2.0 permits bundling
# in this image, unlike YOLOv9 (GPL-3.0) or YOLO-NAS (non-commercial weights). The CPU-only tier uses
# Frigate's own native `cpu` detector — field testing showed YOLOX overloads it, even the smallest
# variant.
RUN mkdir -p /app/models \
	&& curl -fsSL -o /app/models/yolox_s.onnx https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_s.onnx

COPY --from=build /app/publish .
COPY src/vyzio/vendors /app/vendors
COPY src/vyzio/Vyzio.Api/entrypoint.sh /entrypoint.sh

# Non-root user. The entrypoint runs as root briefly to join the Docker socket group, then drops to vyzio.
RUN addgroup -S vyzio \
	&& adduser -S -G vyzio vyzio \
	&& mkdir -p /app/data /config \
	&& chown -R vyzio:vyzio /app /config \
	&& chmod +x /entrypoint.sh

EXPOSE 8443
# nosemgrep: dockerfile.security.missing-user-entrypoint.missing-user-entrypoint
ENTRYPOINT ["/entrypoint.sh"]
