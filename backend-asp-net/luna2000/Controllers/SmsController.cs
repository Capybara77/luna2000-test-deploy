using luna2000.Data;
using luna2000.Dto;
using luna2000.Models;
using luna2000.SmsServices;
using luna2000.Telegram;
using Microsoft.AspNetCore.Mvc;

namespace luna2000.Controllers;

public class SmsController : ControllerBase
{
    private readonly LunaDbContext _dbContext;
    private readonly ISmsParserService _smsParserService;
    private readonly ITelegramClient _telegramClient;

    public SmsController(LunaDbContext dbContext, ISmsParserService smsParserService, ITelegramClient telegramClient)
    {
        _dbContext = dbContext;
        _smsParserService = smsParserService;
        _telegramClient = telegramClient;
    }

    [HttpPost]
    [HttpGet]
    public async Task<IActionResult> Receive(SmsReceiveRequest smsReceiveRequest)
    {
        var amount = _smsParserService.GetAmountByMessageText(smsReceiveRequest.Message);
        var driverId = _smsParserService.GetDriverIdByMessageText(smsReceiveRequest.Message);

        // Лог самого SMS-сообщения (сырой)
        var rawMessage = $"Сообщение от: {smsReceiveRequest.Sender}\r\nТекст сообщения: {smsReceiveRequest.Message}";
        CreateSmsLog(rawMessage, driverId);

        // Если успешно распознали — пополняем баланс и пишем отдельный лог
        decimal? newBalance = AddDriverBalance(amount, driverId);
        if (amount != null && driverId != null && newBalance != null)
        {
            var driver = _dbContext.Set<DriverEntity>().FirstOrDefault(e => e.Id == driverId);
            if (driver != null)
            {
                _dbContext.Set<BaseLog>().Add(new BaseLog
                {
                    ChangeId = Guid.NewGuid(),
                    Created = DateTime.UtcNow,
                    EventType = EventType.Event,
                    EntryId = driverId,
                    ObjectName = "SmsBalance",
                    Note = $"Пополнение баланса: {driver.Fio} — +{amount:0.##} руб. | Новый баланс: {newBalance:0.##} руб."
                });
            }
        }

        await SendTelegramMessage(driverId, amount);
        await _dbContext.SaveChangesAsync();
        return Ok();
    }

    private async Task SendTelegramMessage(Guid? driverId, decimal? amount)
    {
        if (driverId == null || amount == null) return;

        var driver = _dbContext.Drivers.First(entity => entity.Id == driverId);

        if (driver.TelegramChatId != null)
        {
            await _telegramClient.TrySendMessage(driver.TelegramChatId.Value, $"Зачислен платеж {amount} руб.");
        }
    }

    private decimal? AddDriverBalance(decimal? amount, Guid? driverId)
    {
        if (amount == null || driverId == null) return null;

        var driver = _dbContext.Set<DriverEntity>()
            .FirstOrDefault(entity => entity.Id == driverId);

        if (driver == null) return null;

        driver.Balance += amount.Value;
        return driver.Balance;
    }

    private void CreateSmsLog(string message, Guid? driverId = null)
    {
        _dbContext.Set<BaseLog>()
            .Add(new BaseLog
            {
                ChangeId = Guid.NewGuid(),
                Created = DateTime.UtcNow,
                EventType = EventType.Add,
                EntryId = driverId,
                ObjectName = "SmsReceived",
                Note = message
            });
    }
}
