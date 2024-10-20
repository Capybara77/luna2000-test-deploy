namespace luna2000.Service;

public interface IJobServerService
{
    Task<bool> IsJobExists(string jobId);

    Task DisableJob(string jobId);

    Task EnableJob();
}