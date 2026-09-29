using System.Text;
using System.Text.Json;
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
    public async Task<IActionResult> Receive([FromQuery] SmsReceiveRequest? queryParams)
    {
        string? sender = queryParams?.Sender;
        string? message = queryParams?.Message;

        // 1. Проверяем Form-данные (application/x-www-form-urlencoded / multipart/form-data)
        if (Request.HasFormContentType)
        {
            try
            {
                var form = await Request.ReadFormAsync();
                sender ??= GetFormValue(form, "sender", "from", "phone", "address");
                message ??= GetFormValue(form, "message", "text", "msg", "body", "content", "sms");
            }
            catch
            {
                // Игнорируем ошибки чтения формы
            }
        }

        // 2. Если сообщение всё ещё не получено, пробуем прочитать тело запроса (JSON или raw text)
        if (string.IsNullOrWhiteSpace(message) && Request.ContentLength is > 0 or null)
        {
            try
            {
                using var reader = new StreamReader(Request.Body, Encoding.UTF8);
                var rawBody = await reader.ReadToEndAsync();

                if (!string.IsNullOrWhiteSpace(rawBody))
                {
                    var jsonParsed = false;
                    try
                    {
                        using var doc = JsonDocument.Parse(rawBody);
                        var root = doc.RootElement;
                        if (root.ValueKind == JsonValueKind.Object)
                        {
                            foreach (var prop in root.EnumerateObject())
                            {
                                if (MatchesAny(prop.Name, "message", "text", "msg", "body", "content", "sms"))
                                {
                                    message ??= prop.Value.GetString();
                                    jsonParsed = true;
                                }
                                else if (MatchesAny(prop.Name, "sender", "from", "phone", "address"))
                                {
                                    sender ??= prop.Value.GetString();
                                    jsonParsed = true;
                                }
                            }
                        }
                    }
                    catch
                    {
                        // Не JSON
                    }

                    // Если это был не JSON или в JSON не было ключевых полей, используем само тело как текст СМС
                    if (!jsonParsed && string.IsNullOrWhiteSpace(message))
                    {
                        message = rawBody;
                    }
                }
            }
            catch
            {
                // Игнорируем ошибки чтения потока
            }
        }

        // Если после всех попыток сообщение пустое
        if (string.IsNullOrWhiteSpace(message))
        {
            CreateSmsLog($"[Предупреждение] Получен пустой запрос на /sms/receive. Отправитель: {sender ?? "не указан"}");
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = false, message = "Empty message received" });
        }

        var amount = _smsParserService.GetAmountByMessageText(message);
        var driverId = _smsParserService.GetDriverIdByMessageText(message);

        // Лог самого SMS-сообщения (сырой)
        var rawMessage = $"Сообщение от: {sender ?? "Не указан"}\r\nТекст сообщения: {message}";
        CreateSmsLog(rawMessage, driverId);

        // Если сумму распознали, но водителя найти не удалось - создаём предупреждающий лог
        if (amount != null && driverId == null)
        {
            _dbContext.Set<BaseLog>().Add(new BaseLog
            {
                ChangeId = Guid.NewGuid(),
                Created = DateTime.UtcNow,
                EventType = EventType.Event,
                ObjectName = "SmsWarning",
                Note = $"[ВНИМАНИЕ] Распознано пополнение на +{amount:0.##} руб., но водитель НЕ найден в базе! Добавьте псевдоним водителю. Текст СМС: {message}"
            });
        }

        // Если успешно распознали и сумму, и водителя — пополняем баланс и пишем лог
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
        return Ok(new { success = true, amount, driverId, newBalance });
    }

    private static string? GetFormValue(IFormCollection form, params string[] keys)
    {
        foreach (var key in keys)
        {
            var match = form.Keys.FirstOrDefault(k => string.Equals(k, key, StringComparison.OrdinalIgnoreCase));
            if (match != null && form.TryGetValue(match, out var val) && !string.IsNullOrWhiteSpace(val))
            {
                return val.ToString();
            }
        }
        return null;
    }

    private static bool MatchesAny(string name, params string[] keys)
    {
        return keys.Any(k => string.Equals(k, name, StringComparison.OrdinalIgnoreCase));
    }

    private async Task SendTelegramMessage(Guid? driverId, decimal? amount)
    {
        if (driverId == null || amount == null) return;

        var driver = _dbContext.Drivers.FirstOrDefault(entity => entity.Id == driverId);

        if (driver?.TelegramChatId != null)
        {
            await _telegramClient.TrySendMessage(driver.TelegramChatId.Value, $"Зачислен платеж {amount:0.##} руб.");
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
