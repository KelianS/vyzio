FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy only production csproj files to leverage Docker layer cache for restore
COPY src/vyzio/Vyzio.Core/Vyzio.Core.csproj               ./src/vyzio/Vyzio.Core/Vyzio.Core.csproj
COPY src/vyzio/Vyzio.Application/Vyzio.Application.csproj ./src/vyzio/Vyzio.Application/Vyzio.Application.csproj
COPY src/vyzio/Vyzio.Infrastructure/Vyzio.Infrastructure.csproj ./src/vyzio/Vyzio.Infrastructure/Vyzio.Infrastructure.csproj
COPY src/vyzio/Vyzio.Api/Vyzio.Api.csproj                 ./src/vyzio/Vyzio.Api/Vyzio.Api.csproj
# Restore only the API project (excludes Tests, not needed in production image)
RUN dotnet restore ./src/vyzio/Vyzio.Api/Vyzio.Api.csproj

COPY src/vyzio ./src/vyzio
RUN dotnet publish ./src/vyzio/Vyzio.Api/Vyzio.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
RUN apt-get update \
	&& apt-get install -y --no-install-recommends docker.io \
	&& rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
EXPOSE 8443
ENTRYPOINT ["dotnet", "Vyzio.Api.dll"]
