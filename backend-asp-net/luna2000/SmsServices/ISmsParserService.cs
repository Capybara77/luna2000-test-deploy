namespace luna2000.SmsServices;

public interface ISmsParserService
{
    decimal? GetAmountByMessageText(string messageText);

    Guid? GetDriverIdByMessageText(string messageText);
}