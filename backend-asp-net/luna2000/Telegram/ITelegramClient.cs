namespace luna2000.Telegram;

public interface ITelegramClient
{
    string CreateUrlInvite(Guid userId);

    Task TrySendMessage(long chatId, string message);
}