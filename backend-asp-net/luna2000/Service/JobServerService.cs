using System.Text.Json;
using luna2000.Options;
using Microsoft.Extensions.Options;

namespace luna2000.Service;

public class JobServerService : IJobServerService
{
    private static readonly HttpClient HttpClient = new();
    private readonly JobServerConfiguration _jobServerConfiguration;

    public JobServerService(IOptions<JobServerConfiguration> jobServerConfiguration)
    {
        _jobServerConfiguration = jobServerConfiguration.Value;
    }

    static JobServerService()
    {
        HttpClient.Timeout = TimeSpan.FromSeconds(1);
    }

    public async Task<bool> IsJobExists(string jobId)
    {
        using var response = await HttpClient.PostAsync(
            $"http://{_jobServerConfiguration.BaseUrl}:{_jobServerConfiguration.Port}/api/jobs/exists/{jobId}", null);

        var content = await response.Content.ReadAsStringAsync();

        var jsonDocument = JsonDocument.Parse(content);
        return jsonDocument.RootElement.GetProperty("isExists").GetBoolean();
    }

    public async Task DisableJob(string jobId)
    {
        using var response = await HttpClient.PostAsync(
            $"http://{_jobServerConfiguration.BaseUrl}:{_jobServerConfiguration.Port}/api/jobs/disable/{jobId}",
            null);
    }

    public async Task EnableJob()
    {
        using var response = await HttpClient.PostAsync(
            $"http://{_jobServerConfiguration.BaseUrl}:{_jobServerConfiguration.Port}/api/jobs/enable", null);
    }
}