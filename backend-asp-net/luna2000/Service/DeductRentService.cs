using luna2000.Data;
using luna2000.Models;
using luna2000.Options;
using luna2000.Telegram;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace luna2000.Service;

public class DeductRentService : IDeductRentService
{
    private readonly LunaDbContext _dbContext;
    private readonly ITelegramClient _telegramClient;
    private readonly CommonDataConfiguration _commonOptions;

    public DeductRentService(LunaDbContext dbContext, ITelegramClient telegramClient,
        IOptions<CommonDataConfiguration> commonOptions)
    {
        _dbContext = dbContext;
        _telegramClient = telegramClient;
        _commonOptions = commonOptions.Value;
    }

    public async Task DeductRent()
    {
        var carRentals = await _dbContext.Set<CarRentalEntity>()
            .Include(entity => entity.Driver)
            .Include(entity => entity.Schedules)
            .ToArrayAsync();

        foreach (var carRental in carRentals)
        {
            if (!carRental.Schedules!.Select(entity => entity.DayOfWeek).Contains(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow,
                    TimeZoneInfo.FindSystemTimeZoneById(_commonOptions.TimeZone)).DayOfWeek))
            {
                continue;
            }

            carRental.Driver!.Balance -= carRental.Rent;

            if (carRental.Driver!.Balance < 0 && carRental.Driver!.TelegramChatId != null)
            {
                await _telegramClient.TrySendMessage(carRental.Driver!.TelegramChatId.Value,
                    $"Уважаемый(ая) {carRental.Driver!.Fio}, ваш текущий баланс: {carRental.Driver!.Balance}. " +
                    $"Пожалуйста, пополните баланс.");
            }
        }

        await _dbContext.SaveChangesAsync();
    }
}