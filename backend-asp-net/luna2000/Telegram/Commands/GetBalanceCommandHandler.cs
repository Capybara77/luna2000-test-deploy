using luna2000.Data;
using luna2000.Models;
using Microsoft.EntityFrameworkCore;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace luna2000.Telegram.Commands;

public class GetBalanceCommandHandler : ITelegramCommandHandler
{
    private readonly LunaDbContext _dbContext;

    public GetBalanceCommandHandler(LunaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task HandleAsync(Message message, UpdateType type, TelegramBotClient botClient)
    {
        if (message.Text != "/balance")
        {
            return;
        }

        var driver = await _dbContext.Set<DriverEntity>()
            .Where(entity => entity.TelegramChatId == message.Chat.Id)
            .FirstOrDefaultAsync();

        if (driver == null)
        {
            await botClient.SendMessage(message.Chat.Id, "Нет привязки к водителю");
            return;
        }

        await botClient.SendMessage(message.Chat.Id, $"Ваш баланс: {driver.Balance} руб.");
    }
}