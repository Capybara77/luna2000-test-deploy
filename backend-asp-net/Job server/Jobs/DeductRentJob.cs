using Job_server.Options;
using Microsoft.Extensions.Options;

namespace Job_server.Jobs;

public class DeductRentJob
{
    private static readonly HttpClient HttpClient = new();
    private readonly ConnectionConfiguration _connectionOptions;

    public DeductRentJob(IOptions<ConnectionConfiguration> connectionOptions)
    {
        _connectionOptions = connectionOptions.Value;
    }

    public async Task DeductRent()
    {
        await HttpClient
            .PostAsync($"http://{_connectionOptions.BaseUrl}:{_connectionOptions.Port}/api/deduct-rent", null);
    }
}