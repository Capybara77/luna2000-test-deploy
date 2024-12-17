using luna2000.Telegram.Commands;

namespace luna2000.Telegram.IoC;

public static class Module
{
    public static IServiceCollection AddTelegramCommands(this IServiceCollection collection)
    {
        return collection
            .AddScoped<ITelegramCommandHandler, StartCommandHandler>()
            .AddScoped<ITelegramCommandHandler, GetBalanceCommandHandler>();
    }
}