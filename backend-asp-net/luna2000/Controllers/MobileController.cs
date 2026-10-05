using luna2000.Data;
using luna2000.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace luna2000.Controllers;

/// <summary>
/// Мобильное API для водителей (без IP-ограничений, JWT-авторизация).
/// Base path: /mobile
/// </summary>
[Route("mobile")]
[ApiController]
public class MobileController : ControllerBase
{
    private readonly LunaDbContext _db;
    private readonly IConfiguration _config;

    public MobileController(LunaDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    // ──────────────────────────────────────────────
    // POST /mobile/auth
    // Body: { "driverId": "guid" }
    // Returns JWT token
    // ──────────────────────────────────────────────
    [HttpPost("auth")]
    public async Task<IActionResult> Auth([FromBody] MobileAuthRequest request)
    {
        var input = request?.DriverId?.Trim();
        if (string.IsNullOrWhiteSpace(input))
            return BadRequest(new { error = "Код доступа не может быть пустым" });

        DriverEntity? driver = null;

        if (Guid.TryParse(input, out var driverId))
        {
            driver = await _db.Drivers.AsNoTracking().FirstOrDefaultAsync(d => d.Id == driverId);
        }

        // Если не найден по Guid, пробуем найти по логину пользователя
        if (driver == null)
        {
            var user = await _db.Set<UserEntity>().AsNoTracking()
                .FirstOrDefaultAsync(u => u.Login == input && u.DriverId != null);
            if (user?.DriverId != null)
            {
                driver = await _db.Drivers.AsNoTracking().FirstOrDefaultAsync(d => d.Id == user.DriverId.Value);
            }
        }

        // Если всё ещё не найден, пробуем найти по контактам
        if (driver == null)
        {
            driver = await _db.Drivers.AsNoTracking()
                .FirstOrDefaultAsync(d => d.Contacts != null && d.Contacts.Contains(input));
        }

        if (driver == null)
            return NotFound(new { error = "Водитель не найден" });

        var token = GenerateJwt(driver);
        return Ok(new
        {
            token,
            driverId = driver.Id,
            fio = driver.Fio
        });
    }

    // ──────────────────────────────────────────────
    // ──────────────────────────────────────────────
    // GET /mobile/balance
    // Returns balance + full operation history for this driver
    // ──────────────────────────────────────────────
    [HttpGet("balance")]
    [Authorize(AuthenticationSchemes = "MobileJwt")]
    public async Task<IActionResult> Balance()
    {
        var driverId = GetDriverId();
        if (driverId == null) return Unauthorized();

        var driver = await _db.Drivers.AsNoTracking().FirstOrDefaultAsync(d => d.Id == driverId);
        if (driver == null) return NotFound();

        // История операций водителя (до 60 последних операций без обрезания по дате)
        var logs = await _db.BaseLogs
            .Where(l => l.EntryId == driverId)
            .OrderByDescending(l => l.Created)
            .Take(60)
            .AsNoTracking()
            .ToListAsync();

        var operations = logs.Select(l =>
        {
            bool isDebit = false;
            string title = l.ObjectName switch
            {
                "DeductRent" => "Списание аренды",
                "SmsBalance" => "Пополнение баланса (SMS)",
                "SmsReceived" => "SMS входящий",
                "Balance" => "Корректировка баланса",
                _ => l.EventType switch
                {
                    EventType.Add => "Создание записи",
                    EventType.Delete => "Удаление",
                    EventType.Edit => "Изменение данных",
                    EventType.Event => "Событие",
                    _ => "Операция"
                }
            };

            string noteText = l.Note ?? string.Empty;

            decimal? opAmount = null;

            if (l.ObjectName == "DeductRent")
            {
                isDebit = true;
                var m = System.Text.RegularExpressions.Regex.Match(noteText, @"—\s*([0-9\s]+(?:[.,][0-9]{1,2})?)\s*руб");
                if (m.Success && decimal.TryParse(m.Groups[1].Value.Replace(" ", "").Replace(",", "."), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var a))
                    opAmount = a;
            }
            else if (l.ObjectName == "SmsBalance")
            {
                isDebit = false;
                var m = System.Text.RegularExpressions.Regex.Match(noteText, @"\+\s*([0-9\s]+(?:[.,][0-9]{1,2})?)\s*руб");
                if (m.Success && decimal.TryParse(m.Groups[1].Value.Replace(" ", "").Replace(",", "."), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var a))
                    opAmount = a;
            }
            else if (l.PropertyName == "Balance" || l.ObjectName == "Balance")
            {
                if (decimal.TryParse(l.OldValue, out var oldVal) && decimal.TryParse(l.NewValue, out var newVal))
                {
                    isDebit = newVal < oldVal;
                    opAmount = Math.Abs(newVal - oldVal);
                    title = isDebit ? "Списание с баланса" : "Пополнение баланса";
                    noteText = $"{(isDebit ? "-" : "+")}{opAmount:0.##} ₽  (Было: {oldVal:0.##} ₽ → Стало: {newVal:0.##} ₽)";
                }
            }
            else if (!string.IsNullOrEmpty(noteText) && (noteText.Contains("Списание") || noteText.Contains("списание")))
            {
                isDebit = true;
            }

            if (string.IsNullOrWhiteSpace(noteText))
            {
                if (!string.IsNullOrEmpty(l.PropertyName))
                    noteText = $"{l.PropertyName}: {l.OldValue} → {l.NewValue}";
                else
                    noteText = title;
            }

            return new
            {
                type = title,
                note = noteText,
                createdAt = l.Created.ToString("o"),
                isDebit,
                amount = opAmount
            };
        });

        var rental = await _db.CarRentals
            .Include(r => r.Car)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.DriverId == driverId);

        var carSummary = rental?.Car != null ? new
        {
            brandModel = rental.Car.BrandModel,
            plateNumber = rental.Car.PlateNumber
        } : null;

        return Ok(new
        {
            balance = driver.Balance,
            fio = driver.Fio,
            car = carSummary,
            operations
        });
    }

    // ──────────────────────────────────────────────
    // GET /mobile/chat/{channel}?page=1
    // Returns last 50 messages in channel
    // ──────────────────────────────────────────────
    [HttpGet("chat/{channel:int}")]
    [Authorize(AuthenticationSchemes = "MobileJwt")]
    public async Task<IActionResult> ChatHistory(int channel, int page = 1)
    {
        const int pageSize = 50;
        if (channel < 0 || channel > 2) return BadRequest(new { error = "Канал 0-2" });

        var messages = await _db.ChatMessages
            .Include(m => m.Driver)
            .Where(m => m.Channel == (ChatChannel)channel)
            .OrderByDescending(m => m.CreatedAt)
            .Skip(pageSize * (page - 1))
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync();

        return Ok(messages.Select(m => new
        {
            id = m.Id.ToString(),
            driverId = m.DriverId?.ToString() ?? string.Empty,
            driverName = m.SenderName ?? m.Driver?.Fio ?? "Водитель",
            channel = (int)m.Channel,
            text = m.Text,
            replyToId = m.ReplyToId?.ToString() ?? string.Empty,
            replyToSender = m.ReplyToSender ?? string.Empty,
            replyToText = m.ReplyToText ?? string.Empty,
            createdAt = m.CreatedAt.ToString("o")
        }).OrderBy(m => m.createdAt));
    }

    // ──────────────────────────────────────────────
    private Guid? GetDriverId()
    {
        var claim = User.FindFirst("driverId")?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    private string GenerateJwt(DriverEntity driver)
    {
        var secret = _config["Mobile:JwtSecret"] ?? "luna2000-default-secret-key-32ch!";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim("driverId", driver.Id.ToString()),
            new Claim(ClaimTypes.Name, driver.Fio)
        };

        var token = new JwtSecurityToken(
            issuer: "luna2000",
            audience: "luna2000-mobile",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // ──────────────────────────────────────────────
    // GET /mobile/repairs
    // Returns driver's repair requests
    // ──────────────────────────────────────────────
    [HttpGet("repairs")]
    [Authorize(AuthenticationSchemes = "MobileJwt")]
    public async Task<IActionResult> GetRepairs()
    {
        var driverId = GetDriverId();
        if (driverId == null) return Unauthorized();

        var requests = await _db.RepairRequests
            .Include(r => r.Car)
            .Where(r => r.DriverId == driverId)
            .OrderByDescending(r => r.CreatedAt)
            .Take(50)
            .AsNoTracking()
            .ToListAsync();

        return Ok(requests.Select(r => new
        {
            id = r.Id.ToString(),
            carInfo = r.Car != null ? $"{r.Car.BrandModel} ({r.Car.PlateNumber})" : "Не указан",
            text = r.Text,
            photoUrl = r.PhotoPath,
            status = (int)r.Status,
            statusName = r.Status switch
            {
                RepairStatus.New => "Новая",
                RepairStatus.InProgress => "В работе",
                RepairStatus.Done => "Выполнена",
                RepairStatus.Rejected => "Отклонена",
                _ => "Новая"
            },
            adminComment = r.AdminComment ?? string.Empty,
            createdAt = r.CreatedAt.ToString("o"),
            updatedAt = r.UpdatedAt?.ToString("o")
        }));
    }

    // ──────────────────────────────────────────────
    // GET /mobile/car
    // Returns driver's assigned vehicle details
    // ──────────────────────────────────────────────
    [HttpGet("car")]
    [Authorize(AuthenticationSchemes = "MobileJwt")]
    public async Task<IActionResult> GetMyCar()
    {
        var driverId = GetDriverId();
        if (driverId == null) return Unauthorized();

        var rental = await _db.CarRentals
            .Include(r => r.Car)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.DriverId == driverId);

        if (rental?.Car == null)
            return Ok(new { hasCar = false });

        var c = rental.Car;
        return Ok(new
        {
            hasCar = true,
            id = c.Id,
            brandModel = c.BrandModel,
            plateNumber = c.PlateNumber,
            vin = c.Vin,
            year = c.Year,
            sts = c.Sts,
            pts = c.Pts,
            osago = c.Osago,
            kasko = c.Kasko,
            techInspection = c.TechInspection?.ToString("dd.MM.yyyy"),
            taxiLicense = c.TaxiLicense == true,
            dailyRent = rental.Rent
        });
    }

    // ──────────────────────────────────────────────
    // POST /mobile/repairs
    // Create new repair request
    // ──────────────────────────────────────────────
    [HttpPost("repairs")]
    [Authorize(AuthenticationSchemes = "MobileJwt")]
    public async Task<IActionResult> CreateRepair([FromBody] CreateRepairRequest request)
    {
        var driverId = GetDriverId();
        if (driverId == null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request?.Text))
            return BadRequest(new { error = "Опишите проблему или необходимый ремонт" });

        var driver = await _db.Drivers.AsNoTracking().FirstOrDefaultAsync(d => d.Id == driverId);
        if (driver == null) return NotFound(new { error = "Водитель не найден" });

        // Определяем авто водителя (переданное или текущее арендованное)
        Guid? carId = request.CarId;
        if (!carId.HasValue || carId == Guid.Empty)
        {
            var rental = await _db.CarRentals
                .Include(r => r.Car)
                .FirstOrDefaultAsync(r => r.DriverId == driverId);
            carId = rental?.CarId;
        }

        string? savedPhotoPath = null;
        if (!string.IsNullOrWhiteSpace(request.PhotoBase64))
        {
            try
            {
                var cleanBase64 = request.PhotoBase64;
                var commaIdx = cleanBase64.IndexOf(',');
                if (commaIdx >= 0)
                {
                    cleanBase64 = cleanBase64.Substring(commaIdx + 1);
                }
                var bytes = Convert.FromBase64String(cleanBase64);
                var dir = Path.Combine(Directory.GetCurrentDirectory(), "files", "repairs");
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

                // Detect image format from magic bytes or default to .webp
                string ext = ".webp";
                if (bytes.Length > 12 && bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46)
                    ext = ".webp";
                else if (bytes.Length > 2 && bytes[0] == 0xFF && bytes[1] == 0xD8)
                    ext = ".jpg";
                else if (bytes.Length > 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47)
                    ext = ".png";

                var fileName = $"{Guid.NewGuid():N}{ext}";
                var fullPath = Path.Combine(dir, fileName);
                await System.IO.File.WriteAllBytesAsync(fullPath, bytes);
                savedPhotoPath = $"/files/repairs/{fileName}";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Error saving repair photo]: {ex.Message}");
            }
        }

        var repair = new RepairRequest
        {
            Id = Guid.NewGuid(),
            DriverId = driverId.Value,
            CarId = carId,
            Text = request.Text.Trim(),
            PhotoPath = savedPhotoPath,
            Status = RepairStatus.New,
            CreatedAt = DateTime.UtcNow
        };

        _db.RepairRequests.Add(repair);
        await _db.SaveChangesAsync();

        var car = carId.HasValue ? await _db.Cars.AsNoTracking().FirstOrDefaultAsync(c => c.Id == carId) : null;
        var carInfo = car != null ? $"{car.BrandModel} ({car.PlateNumber})" : "Не указан";

        return Ok(new
        {
            id = repair.Id.ToString(),
            carInfo,
            text = repair.Text,
            photoUrl = repair.PhotoPath,
            status = (int)repair.Status,
            statusName = "Новая",
            adminComment = string.Empty,
            createdAt = repair.CreatedAt.ToString("o")
        });
    }

    [AllowAnonymous]
    [HttpGet("/download-apk")]
    [HttpHead("/download-apk")]
    [HttpGet("/download/luna2000.apk")]
    [HttpHead("/download/luna2000.apk")]
    [HttpGet("/luna2000.apk")]
    [HttpHead("/luna2000.apk")]
    [HttpGet("/apk")]
    [HttpHead("/apk")]
    [HttpGet("apk")]
    [HttpHead("apk")]
    [HttpGet("/download/app")]
    [HttpHead("/download/app")]
    [HttpGet("/app.apk")]
    [HttpHead("/app.apk")]
    public IActionResult DownloadApk([FromServices] IWebHostEnvironment env)
    {
        var candidates = new[]
        {
            Path.Combine(env.WebRootPath ?? "wwwroot", "apk", "luna2000.apk"),
            Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "apk", "luna2000.apk"),
            Path.Combine(Directory.GetCurrentDirectory(), "files", "luna2000.apk"),
            Path.Combine(Directory.GetCurrentDirectory(), "files", "apk", "luna2000.apk"),
            Path.Combine(env.ContentRootPath, "files", "luna2000.apk"),
            Path.Combine(env.ContentRootPath, "..", "..", "luna2000-driver.apk"),
            Path.Combine(Directory.GetCurrentDirectory(), "luna2000-driver.apk")
        };

        var path = candidates.FirstOrDefault(System.IO.File.Exists);
        if (path == null)
        {
            return NotFound("APK не найден на сервере.");
        }

        // Если это запрос страницы /download-apk из браузера — показываем информационную страницу с инструкцией и автоскачиванием
        var acceptHeader = Request.Headers["Accept"].ToString();
        var isHtmlRequest = acceptHeader.Contains("text/html", StringComparison.OrdinalIgnoreCase);
        var isDirectDownload = Request.Path.Value?.EndsWith(".apk", StringComparison.OrdinalIgnoreCase) == true
            || Request.Query.ContainsKey("direct")
            || Request.Query.ContainsKey("download");

        if (isHtmlRequest && !isDirectDownload && HttpMethods.IsGet(Request.Method))
        {
            var fileInfo = new FileInfo(path);
            var sizeMb = (fileInfo.Length / (1024.0 * 1024.0)).ToString("0.0", System.Globalization.CultureInfo.InvariantCulture);
            return Content(RenderApkDownloadPage(sizeMb), "text/html; charset=utf-8");
        }

        Response.Headers["Content-Disposition"] = "attachment; filename=\"luna2000.apk\"";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
        Response.Headers["Pragma"] = "no-cache";
        Response.Headers["Expires"] = "0";

        return PhysicalFile(path, "application/vnd.android.package-archive", "luna2000.apk", enableRangeProcessing: true);
    }

    private static string RenderApkDownloadPage(string sizeMb)
    {
        return $@"<!DOCTYPE html>
<html lang=""ru"">
<head>
    <meta charset=""utf-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"">
    <title>Скачать приложение LUNA 2000</title>
    <link rel=""icon"" href=""/favicon.ico"">
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }}
        body {{
            background: linear-gradient(165deg, #070d1a 0%, #0d1f3c 60%, #070d1a 100%);
            color: #f0f6ff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
        }}
        .card {{
            background: rgba(13, 31, 60, 0.85);
            border: 1px solid #1e3a5f;
            border-radius: 24px;
            padding: 28px 22px;
            max-width: 440px;
            width: 100%;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 40px rgba(59, 130, 246, 0.15);
            text-align: center;
            backdrop-filter: blur(12px);
        }}
        .logo-wrap {{
            width: 72px;
            height: 72px;
            margin: 0 auto 14px;
            border-radius: 20px;
            background: linear-gradient(135deg, #1d4ed8, #3b82f6);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 34px;
            box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
        }}
        h1 {{ font-size: 24px; font-weight: 900; letter-spacing: 1px; margin-bottom: 4px; color: #ffffff; }}
        .subtitle {{ font-size: 13px; color: #94a3b8; margin-bottom: 20px; }}
        .badge {{
            display: inline-block;
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 11px;
            font-weight: 700;
            margin-bottom: 20px;
        }}
        .btn-download {{
            display: block;
            width: 100%;
            background: linear-gradient(90deg, #1d4ed8, #2563eb);
            color: #ffffff;
            font-size: 16px;
            font-weight: 800;
            padding: 16px 20px;
            border-radius: 14px;
            text-decoration: none;
            box-shadow: 0 6px 20px rgba(37, 99, 235, 0.45);
            transition: transform 0.15s, box-shadow 0.15s;
            margin-bottom: 12px;
        }}
        .btn-download:active {{ transform: scale(0.98); }}
        .status-msg {{
            font-size: 12px;
            color: #94a3b8;
            margin-bottom: 22px;
            min-height: 18px;
        }}
        .notice-inapp {{
            display: none;
            background: rgba(234, 179, 8, 0.12);
            border: 1px solid rgba(234, 179, 8, 0.35);
            border-radius: 14px;
            padding: 12px 14px;
            margin-bottom: 20px;
            text-align: left;
            font-size: 12px;
            line-height: 1.45;
            color: #fef08a;
        }}
        .notice-inapp b {{ color: #ffffff; }}
        .steps {{
            background: rgba(7, 13, 26, 0.6);
            border: 1px solid #1e3a5f;
            border-radius: 16px;
            padding: 16px;
            text-align: left;
        }}
        .steps-title {{
            font-size: 12px;
            font-weight: 800;
            color: #60a5fa;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
        }}
        .step-item {{
            display: flex;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 12px;
        }}
        .step-item:last-child {{ margin-bottom: 0; }}
        .step-num {{
            background: #1e3a5f;
            color: #93c5fd;
            font-size: 11px;
            font-weight: 800;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin-top: 1px;
        }}
        .step-text {{ font-size: 12px; line-height: 1.45; color: #cbd5e1; }}
        .step-text b {{ color: #ffffff; }}
        .footer-note {{
            margin-top: 16px;
            font-size: 11px;
            color: #64748b;
        }}
    </style>
</head>
<body>
    <div class=""card"">
        <div class=""logo-wrap"">🌙</div>
        <h1>LUNA 2000</h1>
        <div class=""subtitle"">Официальное мобильное приложение водителя</div>
        <div class=""badge"">Версия 1.3.0 • Android • {sizeMb} МБ</div>

        <div id=""inAppNotice"" class=""notice-inapp"">
            ⚠️ <b>Вы открыли ссылку в мессенджере</b><br>
            Если загрузка не началась: нажмите <b>три точки (⋮)</b> в правом верхнем углу и выберите <b>«Открыть в браузере»</b> (Chrome, Яндекс, Samsung).
        </div>

        <a id=""downloadBtn"" href=""/luna2000.apk?direct=1"" class=""btn-download"">
            📥 Скачать APK ({sizeMb} МБ)
        </a>
        <div id=""statusMsg"" class=""status-msg"">⏳ Запуск скачивания...</div>

        <div class=""steps"">
            <div class=""steps-title"">Как установить (инструкция)</div>
            <div class=""step-item"">
                <div class=""step-num"">1</div>
                <div class=""step-text"">
                    При вопросе браузера <b>«Файл может быть опасным»</b> нажмите <b>«Всё равно скачать»</b>. Это стандартное системное уведомление Android для любых приложений не из Google Play.
                </div>
            </div>
            <div class=""step-item"">
                <div class=""step-num"">2</div>
                <div class=""step-text"">
                    После окончания загрузки нажмите <b>«Открыть»</b> в панели уведомлений или шторке телефона.
                </div>
            </div>
            <div class=""step-item"">
                <div class=""step-num"">3</div>
                <div class=""step-text"">
                    Если телефон напишет о блокировке: нажмите <b>«Настройки»</b> → включите <b>«Разрешить установку из этого источника»</b> и нажмите <b>«Установить»</b>.
                </div>
            </div>
        </div>

        <div class=""footer-note"">
            Не началось? <a href=""/luna2000.apk?direct=1"" style=""color:#60a5fa; font-weight:700;"">Нажмите сюда для повтора</a>
        </div>
    </div>

    <script>
        (function() {{
            var ua = navigator.userAgent || '';
            var isInApp = /telegram|fban|fbav|instagram|vkclient|whatsapp|micromessenger|line/i.test(ua);
            if (isInApp) {{
                var el = document.getElementById('inAppNotice');
                if (el) el.style.display = 'block';
            }}

            // Автостарт скачивания через 600мс
            setTimeout(function() {{
                try {{
                    var iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = '/luna2000.apk?direct=1';
                    document.body.appendChild(iframe);
                }} catch(e) {{}}

                var status = document.getElementById('statusMsg');
                if (status) {{
                    status.innerHTML = '✅ Если загрузка не началась — нажмите на синюю кнопку выше';
                }}
            }}, 600);
        }})();
    </script>
</body>
</html>";
    }

    /// <summary>
    /// Проверка актуальной версии приложения для авто-обновлений
    /// </summary>
    [AllowAnonymous]
    [HttpGet("version")]
    public IActionResult GetAppVersion()
    {
        return Ok(new
        {
            version = "1.3.0",
            versionCode = 13,
            downloadUrl = "/luna2000.apk?direct=1",
            changelog = "Добавлены быстрые контакты парка (Начальник, Механик, Техподдержка), фильтры истории операций и месячные итоги"
        });
    }
}

public class MobileAuthRequest
{
    public string DriverId { get; set; } = string.Empty;
}

public class CreateRepairRequest
{
    public string Text { get; set; } = string.Empty;
    public Guid? CarId { get; set; }
    public string? PhotoBase64 { get; set; }
}

