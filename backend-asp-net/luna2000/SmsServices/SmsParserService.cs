using System.Globalization;
using System.Text.RegularExpressions;
using luna2000.Data;
using luna2000.Models;
using Microsoft.EntityFrameworkCore;

namespace luna2000.SmsServices;

public class SmsParserService : ISmsParserService
{
    private readonly LunaDbContext? _dbContext;

    private static readonly Regex AmountRegex = new(
        @"(?:перевод(?:\s+из|\s+через)?|зачислен\w*|поступлен\w*|пополнен\w*|perevod|popolnenie|zachislen\w*|poluchen\s+perevod)(?<bank>.*?)(?:\+?|\s?)(?<amount>\d+(?:[\s]\d{3})*(?:[,\.]\d{1,2})?|\d+)\s*(?<currency>руб\.?|rub|р\.?|rur\.?|r\.?|₽)",
        RegexOptions.CultureInvariant | RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public SmsParserService(LunaDbContext? dbContext)
    {
        _dbContext = dbContext;
    }

    public decimal? GetAmountByMessageText(string? messageText)
    {
        if (string.IsNullOrWhiteSpace(messageText))
        {
            return null;
        }

        var match = AmountRegex.Match(messageText);

        if (!match.Success)
        {
            return null;
        }

        var amountRaw = new string(match.Groups["amount"].Value.Where(c => !char.IsWhiteSpace(c)).ToArray())
            .Replace(',', '.');

        if (decimal.TryParse(amountRaw, NumberStyles.Any, CultureInfo.InvariantCulture,
                out var realAmount))
        {
            return realAmount;
        }

        return null;
    }

    public Guid? GetDriverIdByMessageText(string? messageText)
    {
        if (string.IsNullOrWhiteSpace(messageText) || _dbContext == null)
        {
            return null;
        }

        var drivers = _dbContext.Set<DriverEntity>()
            .Include(driver => driver.Aliases)
            .AsNoTracking()
            .ToArray();

        // 1. Поиск по заданным псевдонимам (Aliases)
        var driverByAlias = drivers
            .Where(d => d.Aliases != null)
            .FirstOrDefault(d => d.Aliases!.Any(a =>
                !string.IsNullOrWhiteSpace(a.Alias) &&
                messageText.Contains(a.Alias.Trim(), StringComparison.OrdinalIgnoreCase)));

        if (driverByAlias != null)
        {
            return driverByAlias.Id;
        }

        // 2. Fallback: поиск по полному ФИО водителя
        var driverByFullFio = drivers.FirstOrDefault(d =>
            !string.IsNullOrWhiteSpace(d.Fio) &&
            messageText.Contains(d.Fio.Trim(), StringComparison.OrdinalIgnoreCase));

        if (driverByFullFio != null)
        {
            return driverByFullFio.Id;
        }

        // 3. Fallback: поиск по фамилии водителя (первое слово ФИО >= 4 букв)
        var driversMatchingLastName = drivers.Where(d =>
        {
            if (string.IsNullOrWhiteSpace(d.Fio)) return false;
            var parts = d.Fio.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0 || parts[0].Length < 4) return false;
            return messageText.Contains(parts[0], StringComparison.OrdinalIgnoreCase);
        }).ToArray();

        // Если ровно один водитель с такой фамилией - безопасно матчим его
        if (driversMatchingLastName.Length == 1)
        {
            return driversMatchingLastName[0].Id;
        }

        return null;
    }
}
