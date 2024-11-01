using luna2000.Data;
using luna2000.Dto;
using luna2000.Models;
using Microsoft.AspNetCore.Mvc;

namespace luna2000.Controllers;

public class SmsController : ControllerBase
{
    private readonly LunaDbContext _dbContext;

    public SmsController(LunaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpPost]
    public IActionResult Receive(SmsReceiveRequest smsReceiveRequest)
    {
        var message = $"New message receive from {smsReceiveRequest.Sender} with text {smsReceiveRequest.Message}";
        Console.WriteLine(message);

        _dbContext.Set<BaseLog>()
            .Add(new BaseLog
            {
                ChangeId = Guid.NewGuid(),
                Created = DateTime.UtcNow,
                EventType = EventType.Add,
                Note = message
            });

        _dbContext.SaveChanges();

        return Ok();
    }
}
