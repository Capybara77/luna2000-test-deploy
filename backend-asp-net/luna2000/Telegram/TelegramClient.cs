using luna2000.Telegram.Commands;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace luna2000.Telegram;

public class TelegramClient : ITelegramClient
{
    private readonly IServiceProvider _serviceProvider;
    private readonly TelegramBotClient? _telegramBotClient;

    public TelegramClient(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;

        var telegramToken = Environment.GetEnvironmentVariable("telegram");

        if (string.IsNullOrEmpty(telegramToken))
        {
            Console.WriteLine("telegram env is null");
            return;
        }

        _telegramBotClient = new TelegramBotClient(telegramToken);
        _telegramBotClient.OnMessage += TelegramBotClientOnOnMessage;
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

    private async Task TelegramBotClientOnOnMessage(Message message, UpdateType type)
    {
        Console.WriteLine($"{DateTime.UtcNow} New telegram message: {message.Text} from {message.Chat.Id}");

        using var scope = _serviceProvider.CreateScope();

        var commandHandlers =
            scope.ServiceProvider.GetService(typeof(IEnumerable<ITelegramCommandHandler>)) as
                IEnumerable<ITelegramCommandHandler>;

        if (commandHandlers == null)
        {
            return;
        }

        foreach (var handler in commandHandlers)
        {
            await handler.HandleAsync(message, type, _telegramBotClient!);
        }
    }
}