using System.Data.Entity.Core;
using luna2000.Data;
using Microsoft.EntityFrameworkCore;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace luna2000.Telegram;

public class TelegramClient : ITelegramClient
{
    private readonly LunaDbContext _dbContext;
    private readonly TelegramBotClient? _telegramBotClient;

    private const string ErrorParseMessage =
        "Не удалось подтверить учетную запись. Воспользуйтесь ссылкой-приглашением";

    public TelegramClient(IServiceProvider serviceProvider)
    {
        Console.WriteLine("tg start");
        _dbContext = serviceProvider.CreateScope()?.ServiceProvider.GetRequiredService<LunaDbContext>() ??
                     throw new ObjectNotFoundException("cant find DbContext while initialize telegram");

        var telegramToken = Environment.GetEnvironmentVariable("telegram");

        if (string.IsNullOrEmpty(telegramToken))
        {
            Console.WriteLine("telegram env is null");
            return;
        }

        _telegramBotClient = new TelegramBotClient(telegramToken);
        _telegramBotClient.OnMessage += TelegramBotClientOnOnMessage;
        Console.WriteLine("telegram init");
    }

    private async Task TelegramBotClientOnOnMessage(Message message, UpdateType type)
    {
        Console.WriteLine(message.Text);
        if (message.Text == null || !message.Text.StartsWith("/start") || message.Text.Split(' ').Length != 2 ||
            _telegramBotClient == null)
        {
            return;
        }

        var driverId = message.Text.Split(" ")[1];

        if (!Guid.TryParse(driverId, out var driverGuid))
        {
            await _telegramBotClient.SendMessage(message.Chat.Id, ErrorParseMessage);
            return;
        }

        var driver = await _dbContext.Drivers
            .FirstOrDefaultAsync(entity => entity.Id == driverGuid);

        if (driver == null)
        {
            await _telegramBotClient.SendMessage(message.Chat.Id, ErrorParseMessage);
            return;
        }

        driver.TelegramChatId = message.Chat.Id;
        await _dbContext.SaveChangesAsync();

        await _telegramBotClient.SendMessage(message.Chat.Id, $"{driver.Fio}, вы подписались на уведомления.");
    }

    public string CreateUrlInvite(Guid userId)
    {
        return $"https://t.me/Luna2000balance_bot?start={userId}";
    }

    public async Task TrySendMessage(long chatId, string message)
    {
        try
        {
            await _telegramBotClient?.SendMessage(chatId, message);
        }
        catch
        {
            // ignored
        }
    }
}