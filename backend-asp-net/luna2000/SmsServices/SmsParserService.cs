using System.Globalization;
using System.Text.RegularExpressions;
using luna2000.Data;
using luna2000.Models;
using Microsoft.EntityFrameworkCore;

namespace luna2000.SmsServices;

public class SmsParserService : ISmsParserService
{
    private readonly LunaDbContext _dbContext;

    public SmsParserService(LunaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public decimal? GetAmountByMessageText(string messageText)
    {
        var regex = new Regex(
            @"(?:перевод из|перевод|perevod|popolnenie)(?<bank>.*?)(?:\+?|\s?)(?<amount>[\d\.]+(?:\s[\d]+)?)(?:\s?)(?<currency>руб|rub|р|r\.|rur\.)",
            RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

        var match = regex.Match(messageText);

        if (!match.Success)
        {
            return null;
        }

        var amountRaw = match.Groups["amount"].Value;

        if (decimal.TryParse(amountRaw.Replace(" ", string.Empty), NumberStyles.Any, CultureInfo.InvariantCulture,
                out var realAmount))
        {
            return realAmount;
        }

        return null;
    }

    public Guid? GetDriverIdByMessageText(string messageText)
    {
        var drivers = _dbContext.Set<DriverEntity>()
            .Include(driver => driver.Aliases)
            .AsNoTracking()
            .ToArray();

        var driver = drivers
            .Where(d => d.Aliases != null)
            .FirstOrDefault(d => d.Aliases!.Any(a => messageText.ToLower().Contains(a.Alias.ToLower())));

        return driver?.Id;
    }
}
