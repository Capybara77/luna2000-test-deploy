using luna2000.Converters;
using luna2000.Data;
using luna2000.Hubs;
using luna2000.Logs;
using luna2000.Logs.Impl;
using luna2000.MapperProfiles;
using luna2000.Middlewares;
using luna2000.Models;
using luna2000.Options;
using luna2000.Service;
using luna2000.SmsServices;
using luna2000.Telegram;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using System.Globalization;
using System.Text;
using luna2000.Telegram.IoC;

namespace luna2000;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.Services.AddControllersWithViews()
            .AddJsonOptions(options =>
                {
                    options.JsonSerializerOptions.Converters.Add(new DateOnlyJsonConverter());
                });

        // SignalR
        builder.Services.AddSignalR();

        // CORS — для мобильного приложения
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("MobilePolicy", policy =>
                policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
        });

        AddLogs(builder);

        builder.Services.AddDbContext<LunaDbContext>(ServiceLifetime.Scoped);
        builder.Services.AddScoped<IDbContextFactory<LunaDbContext>, DbContextFactory>();
        builder.Services.AddScoped<IFileStorage, FileStorage>();
        builder.Services.AddScoped<IJobServerService, JobServerService>();
        builder.Services.AddScoped<IDeductRentService, DeductRentService>();
        builder.Services.AddSingleton<ITelegramClient, TelegramClient>();
        builder.Services.AddAutoMapper(expression => expression.AddProfiles(new[]
        {
            new EntityProfiles()
        }));
        builder.Services.AddScoped<ISmsParserService, SmsParserService>();
        builder.Services.AddTelegramCommands();

        ConfigureCulture();

        builder.Configuration.AddJsonFile("Configs/job-server.json");
        builder.Configuration.AddJsonFile("Configs/common-data.json");
        builder.Services.Configure<JobServerConfiguration>(builder.Configuration.GetSection("JobServerConfiguration"));
        builder.Services.Configure<CommonDataConfiguration>(builder.Configuration.GetSection("CommonData"));

        AddAuthentication(builder);

        var app = builder.Build();

        // Создаём/обновляем таблицы (без EF миграций)
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<LunaDbContext>();

            // Таблица чата
            db.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ChatMessages (
                    Id TEXT PRIMARY KEY,
                    DriverId TEXT NOT NULL,
                    Channel INTEGER NOT NULL DEFAULT 0,
                    Text TEXT NOT NULL DEFAULT '',
                    CreatedAt TEXT NOT NULL
                );
            ");

            // Добавляем колонки Role и DriverId в Users (игнорируем ошибку если уже есть)
            try { db.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN Role INTEGER NOT NULL DEFAULT 1;"); } catch { }
            try { db.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN DriverId TEXT;"); } catch { }

            // Применяем SQL-скрипт миграции (если есть)
            db.ExecuteMigrationScript();
        }

        using (var scope = app.Services.CreateScope())
        {
            scope.ServiceProvider.GetRequiredService<ITelegramClient>();
        }

        if (!app.Environment.IsDevelopment())
        {
            app.UseExceptionHandler("/Home/Error");
            app.UseHsts();
        }

        app.UseMiddleware<IpRestrictionMiddleware>();

        WithStaticFiles(app);
        app.UseStaticFiles();
        app.UseRouting();

        app.UseCors("MobilePolicy");

        app.UseAuthentication();
        app.UseAuthorization();

        app.MapControllerRoute(
            name: "default",
            pattern: "{controller=Home}/{action=Index}/{id?}");

        // SignalR Chat Hub
        app.MapHub<ChatHub>("/mobile/chathub");

        app.Run();
    }

    private static void WithStaticFiles(WebApplication app)
    {
        var filesPath = "files";

        if (!Directory.Exists(filesPath))
        {
            Directory.CreateDirectory(filesPath);
        }

        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(
                Path.Combine(Directory.GetCurrentDirectory(), filesPath)),
            RequestPath = ""
        });
    }

    private static void ConfigureCulture()
    {
        var cultureInfo = new CultureInfo("en-US");
        CultureInfo.DefaultThreadCurrentCulture = cultureInfo;
        CultureInfo.DefaultThreadCurrentUICulture = cultureInfo;
    }

    private static void AddLogs(WebApplicationBuilder builder)
    {
        builder.Services.AddScoped<ILogMessageGeneratorFactory, LogMessageGeneratorFactory>();
        builder.Services.AddTransient<ILogMessageGenerator, PhotoEntityLogMessageGenerator>();
        builder.Services.AddTransient<ILogMessageGenerator, DriverEntityLogMessageGenerator>();
        builder.Services.AddTransient<ILogMessageGenerator, CarEntityLogMessageGenerator>();
        builder.Services.AddTransient<ILogMessageGenerator, CarRentalEntityLogMessageGenerator>();
    }

    private static void AddAuthentication(WebApplicationBuilder builder)
    {
        var jwtSecret = builder.Configuration["Mobile:JwtSecret"] ?? "luna2000-default-secret-key-32ch!";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));

        builder.Services
            .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Events.OnRedirectToLogin += context =>
                {
                    context.HttpContext.Response.Redirect("/login");
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied += context =>
                {
                    context.HttpContext.Response.Redirect("/login");
                    return Task.CompletedTask;
                };

                options.LoginPath = new PathString("/login");
                options.ReturnUrlParameter = "link";
            })
            .AddJwtBearer("MobileJwt", options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = "luna2000",
                    ValidateAudience = true,
                    ValidAudience = "luna2000-mobile",
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = key,
                    ValidateLifetime = true
                };

                // Поддержка JWT в SignalR (токен в query string)
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;
                        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/mobile/chathub"))
                        {
                            context.Token = accessToken;
                        }
                        return Task.CompletedTask;
                    }
                };
            });
    }
}