FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build
WORKDIR /src

# Копируем файл решения и восстанавливаем зависимости
COPY . .
RUN dotnet restore "./luna2000.csproj"

# Публикуем приложение
RUN dotnet publish "luna2000.csproj" -c Release -o /app/publish

# Устанавливаем базовый образ с .NET SDK
FROM mcr.microsoft.com/dotnet/aspnet:6.0 AS base
WORKDIR /app
EXPOSE 5270
RUN mkdir files
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "luna2000.dll", "--urls=http://work.admlistsearch.ru:5270"]
