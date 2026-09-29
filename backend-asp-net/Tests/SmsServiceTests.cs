using FluentAssertions;
using luna2000.SmsServices;
using Xunit;

namespace Tests;

public class SmsServiceTests
{
    [Theory]
    [InlineData("VISA8535 19:59 Перевод из Ozon банк +2400р от ЛИЛИЯ О. Баланс: 9251.67р «Ольховикова Л. Т»",
        2400)]
    [InlineData("SBP. Poluchen perevod 04.11 19:49 (msk). Schet 6962. Zachisleno 10000 r. ot Il'ya Aleksandrovich " +
                "B iz PAO Sberbank BIK 044525225.",
        10000)]
    [InlineData("Karta *7105: 04.11.2024 19:49, popolnenie 10000.00 RUR. Dostupno 24859.20 RUR.",
        10000)]
    [InlineData("перевод 10 000р СКБ Примсоцбанк Баланс: 6851.67р",
        10000)]
    [InlineData("VISA8535 18:28 Перевод из Т‑Банк +1800р от АЛЕКСЕЙ К. Баланс: 16851.67р «Коденев А. Ю.»",
        1800)]
    [InlineData("Перевод из Т‑Банк +1900р от ЕКАТЕРИНА Б. Баланс: 15051.67р «Бабурина Е.Л.»",
        1900)]
    [InlineData("Перевод из Т‑Банк +1900р от АРСЕНИЙ Ш. Баланс: 13151.67р «Шипицын Арсений Андреевич»",
        1900)]
    [InlineData("Перевод из Ozon банк +2000р от МАРИНА С. Баланс: 9351.67р «Сумина М. С.»",
        2000)]
    [InlineData("VISA8535 13:23 Перевод 2700р от Марина Я. Баланс: 7351.67р «Самылов А.В.»",
        2700)]
    [InlineData("VISA8535 11:24 Перевод 2100р от Наталья Г. Баланс: 4651.67р «нестеров евгений александрович»",
        2100)]
    [InlineData("VISA8535 07:57 перевод 3000р Баланс: 2551.67р",
        3000)]
    [InlineData(
        "SBP. Poluchen perevod 04.11 06:39 (msk). Schet 6962. Zachisleno 7000 r. ot Il'ya Aleksandrovich B iz PAO Sberbank BIK 044525225.",
        7000)]
    [InlineData("Karta *7105: 04.11.2024 06:39, popolnenie 7000.00 RUR. Dostupno 14859.20 RUR.",
        7000)]
    [InlineData("VISA8535 20:23 Перевод из Т‑Банк +1800р от АЛЕКСЕЙ К. Баланс: 39783",
        1800)]
    [InlineData("СберБанк. Зачисление 2 500р. от Иван И. через СБП. Баланс 10 500р.",
        2500)]
    [InlineData("СберБанк. Пополнение 1500,00р. Баланс: 3000р.",
        1500)]
    [InlineData("Пополнение +3 000 ₽ от ПЕТР С. через СБП. Доступно 12 345 ₽",
        3000)]
    [InlineData("Перевод 1800₽ от АЛЕКСЕЙ К. Баланс: 16851.67р",
        1800)]
    [InlineData("Поступление 5000 руб. от СЕРГЕЙ В. через СБП. Баланс: 8000 руб.",
        5000)]
    [InlineData("Зачисление 4000р со счета СБП от Ольга С. Баланс: 4500р",
        4000)]
    [InlineData("Зачислено 1500 ₽ от Иван И. Баланс: 3000 ₽",
        1500)]
    [InlineData("Перевод 1500,50 руб от Марина Я.",
        1500.5)]
    [InlineData("Счёт карты VISA8535 08:14 Перевод 10\u00A0000р от Екатерина Б. Баланс: 41\u00A0962.05р «Бабурина Е.Л.»",
        10000)]

    public void GetAmountByMessage(string message, decimal expectedAmount)
    {
        var smsService = new SmsParserService(null);
        var amount = smsService.GetAmountByMessageText(message);
        amount.Should().Be(expectedAmount);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Неизвестный текст без суммы")]
    public void GetAmountByMessage_ReturnsNull_WhenInvalid(string? message)
    {
        var smsService = new SmsParserService(null);
        var amount = smsService.GetAmountByMessageText(message);
        amount.Should().BeNull();
    }
}