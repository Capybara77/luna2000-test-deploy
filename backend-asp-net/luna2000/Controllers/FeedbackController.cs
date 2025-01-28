using luna2000.Options;
using luna2000.Telegram;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace luna2000.Controllers
{
    public class FeedbackController : Controller
    {
        private readonly ITelegramClient _telegramClient;
        private readonly IOptions<CommonDataConfiguration> _commonConfig;

        public FeedbackController(ITelegramClient telegramClient, IOptions<CommonDataConfiguration> commonConfig)
        {
            _telegramClient = telegramClient;
            _commonConfig = commonConfig;
        }

        public IActionResult Index()
        {
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Send(string message, string phoneNumber)
        {
            if (string.IsNullOrEmpty(message) || string.IsNullOrEmpty(phoneNumber))
            {
                ViewBag.ShowMessage = true;
                ViewBag.StatusMessage = "Пожалуйста, заполните все поля";
                return View("Index");
            }

            try
            {
                _telegramClient.TrySendMessage(_commonConfig.Value.OwnerId, $"Текст сообщения: {message}\r\n" +
                                                                            $"Номер телефона: {phoneNumber}");

                ViewBag.ShowMessage = true;
                ViewBag.StatusMessage = "Спасибо! Ваше сообщение успешно отправлено.";
            }
            catch (Exception)
            {
                ViewBag.ShowMessage = true;
                ViewBag.StatusMessage = "Произошла ошибка при отправке сообщения";
            }

            return View("Index");
        }
    }
}
