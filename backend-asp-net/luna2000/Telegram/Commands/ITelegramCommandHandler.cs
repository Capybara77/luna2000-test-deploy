using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace luna2000.Telegram.Commands;

public interface ITelegramCommandHandler
{
    Task HandleAsync(Message message, UpdateType type, TelegramBotClient botClient);
}