using Hangfire;
using Job_server.HangfireOptions;
using Job_server.Jobs;
using Job_server.Options;
using Microsoft.Extensions.Options;

namespace Job_server;

public sealed class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.Services.AddHangfire(configuration => configuration
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UseInMemoryStorage());

        builder.Services.AddHangfireServer();
        builder.Services.AddSingleton(typeof(DeductRentJob));
        builder.Services.AddControllers();

        builder.Configuration.AddJsonFile("Configs/connection.json");

        builder.Services.Configure<ConnectionConfiguration>(
            builder.Configuration.GetSection("ConnectionConfiguration"));

        var app = builder.Build();
        AddDashboard(app, builder);

        app.UseRouting();
        app.UseAuthentication();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapControllers();
        });

        app.Run();
    }

    private static void AddDashboard(WebApplication app, WebApplicationBuilder builder)
    {
        app.UseHangfireDashboard("/hf", new DashboardOptions()
        {
            Authorization = new[] { new AuthorizationFilter() }
        });
        InitJobs(builder);
    }

    private static void InitJobs(WebApplicationBuilder builder)
    {
        var provider = builder.Services.BuildServiceProvider();

        var job = provider.GetService<DeductRentJob>();
        var options = provider.GetService<IOptions<ConnectionConfiguration>>()?.Value;

        if (job == null || options == null)
        {
            throw new NotSupportedException(nameof(InitJobs));
        }

        RecurringJob
            .AddOrUpdate(options.JobId, () => job!.DeductRent(), () => options.Cron, new RecurringJobOptions
            {
                TimeZone = TimeZoneInfo.FindSystemTimeZoneById(options.TimeZone)
            });
    }
}