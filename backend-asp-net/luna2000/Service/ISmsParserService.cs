namespace luna2000.Service;

public interface ISmsParserService
{
    (string name, double amount)? GetNameWithAmount(string messageText);
}