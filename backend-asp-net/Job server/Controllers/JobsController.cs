using Hangfire;
using Hangfire.Storage;
using Job_server.Jobs;
using Job_server.Options;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Job_server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class JobsController : ControllerBase
{
    private readonly DeductRentJob _deductRentJob;
    private readonly IOptions<ConnectionConfiguration> _configuration;

    public JobsController(DeductRentJob deductRentJob, IOptions<ConnectionConfiguration> configuration)
    {
        _deductRentJob = deductRentJob;
        _configuration = configuration;
    }

    [HttpPost("exists/{id}")]
    public IActionResult ExistsJob(string id)
    {
        var job = JobStorage.Current.GetConnection().GetRecurringJobs(new[] { id });

        return Ok(new { IsExists = job != null && job.Any() && job[0].Job != null });
    }

    [HttpPost("disable/{id}")]
    public IActionResult DisableJob(string id)
    {
        RecurringJob.RemoveIfExists(id);

        return Ok();
    }

    [HttpPost("enable")]
    public IActionResult EnableJob()
    {
        RecurringJob.AddOrUpdate(_configuration.Value.JobId, () => _deductRentJob.DeductRent(),
            () => _configuration.Value.Cron, new RecurringJobOptions()
            {
                TimeZone = TimeZoneInfo.FindSystemTimeZoneById(_configuration.Value.TimeZone)
            });

        return Ok();
    }
}
