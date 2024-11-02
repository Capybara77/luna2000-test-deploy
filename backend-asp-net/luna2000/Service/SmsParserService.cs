using System.Globalization;
using System.Text.RegularExpressions;

namespace luna2000.Service;

public class SmsParserService : ISmsParserService
{
    public (string name, double amount)? GetNameWithAmount(string messageText)
    {
        var regex =
            new Regex(@"Перевод(?:\s+(.*?))?\s*(?:\+|)\s*(?<amount>[0-9]+(?:[.,][0-9]+)?)р\s+от\s*(?<name>.*?)\.\s+Баланс");
        var match = regex.Match(messageText);

        if (!match.Success)
        {
            return null;
        }

        if (!double.TryParse(match.Groups["amount"].Value.Replace(",", "."), NumberStyles.Any,
                CultureInfo.InvariantCulture, out var amount))
        {
            return null;
        }

        return (match.Groups["name"].Value, amount);
    }
}