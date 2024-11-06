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
        var message = $"Сообщение от: {smsReceiveRequest.Sender}\r\nТекст сообщения: {smsReceiveRequest.Message}";
        CreateSmsLog(message);

        var amount = _smsParserService.GetAmountByMessageText(smsReceiveRequest.Message);
        var driverId = _smsParserService.GetDriverIdByMessageText(smsReceiveRequest.Message);

        AddDriverBalance(amount, driverId);

        _dbContext.SaveChanges();
        return Ok();
    }

    private void AddDriverBalance(decimal? amount, Guid? driverId)
    {
        if (amount == null || driverId == null) return;

        var driver = _dbContext.Set<DriverEntity>()
            .FirstOrDefault(entity => entity.Id == driverId);

        driver!.Balance += amount.Value;
    }

    private void CreateSmsLog(string message)
    {
        _dbContext.Set<BaseLog>()
            .Add(new BaseLog
            {
                ChangeId = Guid.NewGuid(),
                Created = DateTime.UtcNow,
                EventType = EventType.Add,
                Note = message
            });
    }
}
