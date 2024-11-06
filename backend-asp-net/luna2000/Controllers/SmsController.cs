using luna2000.Data;
using luna2000.Dto;
using luna2000.Models;
using luna2000.SmsServices;
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
    [HttpGet]
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

        var amount = _smsParserService.GetAmountByMessageText(smsReceiveRequest.Message);
        var driverId = _smsParserService.GetDriverIdByMessageText(smsReceiveRequest.Message);

        if (amount != null && driverId != null)
        {
            var driver = _dbContext.Set<DriverEntity>()
                .FirstOrDefault(entity => entity.Id == driverId);

            driver!.Balance += amount.Value;
        }

        _dbContext.SaveChanges();
        return Ok();
    }
}
