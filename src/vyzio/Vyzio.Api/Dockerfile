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
RUN apk add --no-cache docker-cli tzdata icu-libs

ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

COPY --from=build /app/publish .
COPY src/vyzio/vendors /app/vendors

# Non-root user. Docker socket access relies on group_add in docker-compose (see docs/DEPLOYMENT.md).
RUN addgroup -S vyzio \
	&& adduser -S -G vyzio vyzio \
	&& mkdir -p /app/data \
	&& chown -R vyzio:vyzio /app

USER vyzio
EXPOSE 8443
ENTRYPOINT ["dotnet", "Vyzio.Api.dll"]
