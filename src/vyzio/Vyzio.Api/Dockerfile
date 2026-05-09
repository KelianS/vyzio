FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/vyzio/Vyzio.sln ./src/vyzio/Vyzio.sln
COPY src/vyzio/Vyzio.Api/Vyzio.Api.csproj ./src/vyzio/Vyzio.Api/Vyzio.Api.csproj
COPY src/vyzio/Vyzio.Core/Vyzio.Core.csproj ./src/vyzio/Vyzio.Core/Vyzio.Core.csproj
COPY src/vyzio/Vyzio.Infrastructure/Vyzio.Infrastructure.csproj ./src/vyzio/Vyzio.Infrastructure/Vyzio.Infrastructure.csproj
RUN dotnet restore ./src/vyzio/Vyzio.sln

COPY src/vyzio ./src/vyzio
RUN dotnet publish ./src/vyzio/Vyzio.Api/Vyzio.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8443
ENTRYPOINT ["dotnet", "Vyzio.Api.dll"]
