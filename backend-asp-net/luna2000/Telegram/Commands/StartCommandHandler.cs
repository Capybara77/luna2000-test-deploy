using luna2000.Data;
using Microsoft.EntityFrameworkCore;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace luna2000.Telegram.Commands;

public class StartCommandHandler : ITelegramCommandHandler
{
    private readonly LunaDbContext _dbContext;

    private const string ErrorParseMessage =
        "Не удалось подтверить учетную запись. Воспользуйтесь ссылкой-приглашением";

    public StartCommandHandler(LunaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task HandleAsync(Message message, UpdateType type, TelegramBotClient botClient)
    {
        if (message.Text == null || !message.Text.StartsWith("/start") || message.Text.Split(' ').Length != 2)
        {
            return;
        }

        var driverId = message.Text.Split(" ")[1];

        if (!Guid.TryParse(driverId, out var driverGuid))
        {
            await botClient.SendMessage(message.Chat.Id, ErrorParseMessage);
            return;
        }

        var driver = await _dbContext.Drivers
            .FirstOrDefaultAsync(entity => entity.Id == driverGuid);

        if (driver == null)
        {
            await botClient.SendMessage(message.Chat.Id, ErrorParseMessage);
            return;
        }

        driver.TelegramChatId = message.Chat.Id;
        await _dbContext.SaveChangesAsync();

        await botClient.SendMessage(message.Chat.Id, $"{driver.Fio}, вы подписались на уведомления.");
    }
}