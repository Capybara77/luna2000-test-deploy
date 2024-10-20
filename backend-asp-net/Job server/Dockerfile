# Указываем образ с .NET SDK для сборки проекта
FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build
WORKDIR /app

# Копируем .csproj файл и восстанавливаем зависимости
COPY ["Job server.csproj", "./"]
RUN dotnet restore "Job server.csproj"

# Копируем остальные файлы и собираем проект
COPY . .
RUN dotnet publish "Job server.csproj" -c Release -o /app/publish --no-restore

# Указываем образ с .NET Runtime для выполнения
FROM mcr.microsoft.com/dotnet/aspnet:6.0 AS runtime
WORKDIR /app

# Копируем опубликованную сборку из предыдущего этапа
COPY --from=build /app/publish .

# Команда для запуска приложения
EXPOSE 7890
ENTRYPOINT ["dotnet", "Job server.dll", "urls=http://0.0.0.0:7890"]
