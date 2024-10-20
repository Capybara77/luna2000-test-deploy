namespace Job_server.Options;

public class ConnectionConfiguration
{
    public string BaseUrl { get; set; }

    public int Port { get; set; }

    public string JobId { get; set; }

    public string Cron { get; set; }

    public string TimeZone { get; set; }
}