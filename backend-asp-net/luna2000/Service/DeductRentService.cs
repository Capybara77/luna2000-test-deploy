using luna2000.Data;
using luna2000.Models;
using luna2000.Telegram;
using Microsoft.EntityFrameworkCore;

namespace luna2000.Service;

public class DeductRentService : IDeductRentService
{
    private readonly LunaDbContext _dbContext;
    private readonly ITelegramClient _telegramClient;

    public DeductRentService(LunaDbContext dbContext, ITelegramClient telegramClient)
    {
        _dbContext = dbContext;
        _telegramClient = telegramClient;
    }

    public async Task DeductRent()
    {
        var carRentals = await _dbContext.Set<CarRentalEntity>()
            .Include(entity => entity.Driver)
            .ToArrayAsync();

        foreach (var carRental in carRentals)
        {
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