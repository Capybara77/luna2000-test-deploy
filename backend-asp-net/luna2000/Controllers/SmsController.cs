using luna2000.Data;
using luna2000.Dto;
using luna2000.Models;
using luna2000.Service;
using Microsoft.AspNetCore.Mvc;

namespace luna2000.Controllers;

public class SmsController : ControllerBase
{
    private readonly LunaDbContext _dbContext;
    private readonly ISmsParserService _smsParserService;

    public SmsController(LunaDbContext dbContext, ISmsParserService smsParserService)
    {
        _dbContext = dbContext;
        _smsParserService = smsParserService;
    }

    [HttpPost]
    public IActionResult Receive(SmsReceiveRequest smsReceiveRequest)
    {
        var message = $"New message receive from {smsReceiveRequest.Sender} with text {smsReceiveRequest.Message}";

        _dbContext.Set<BaseLog>()
            .Add(new BaseLog
            {
                ChangeId = Guid.NewGuid(),
                Created = DateTime.UtcNow,
                EventType = EventType.Add,
                Note = message
            });

        var smsData = _smsParserService.GetNameWithAmount(smsReceiveRequest.Message);

        if (smsData == null)
        {
            _dbContext.SaveChanges();

            return Ok();
        }

        var driver = _dbContext
            .Set<DriverEntity>()
            .FirstOrDefault(driver => driver.Fio.ToLower().StartsWith(smsData.Value.name.ToLower()));

        if (driver != null)
        {
            driver.Balance += (decimal)smsData.Value.amount;
        }

        _dbContext.SaveChanges();
        return Ok();
    }
}
