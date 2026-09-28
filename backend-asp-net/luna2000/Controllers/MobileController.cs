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

            if (l.ObjectName == "DeductRent")
            {
                isDebit = true;
            }
            else if (l.ObjectName == "SmsBalance")
            {
                isDebit = false;
            }
            else if (l.PropertyName == "Balance" || l.ObjectName == "Balance")
            {
                if (decimal.TryParse(l.OldValue, out var oldVal) && decimal.TryParse(l.NewValue, out var newVal))
                {
                    isDebit = newVal < oldVal;
                    var diff = Math.Abs(newVal - oldVal);
                    title = isDebit ? "Списание с баланса" : "Пополнение баланса";
                    noteText = $"{(isDebit ? "-" : "+")}{diff:0.##} ₽  (Было: {oldVal:0.##} ₽ → Стало: {newVal:0.##} ₽)";
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
                isDebit
            };
        });

        return Ok(new
        {
            balance = driver.Balance,
            fio = driver.Fio,
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

        var repair = new RepairRequest
        {
            Id = Guid.NewGuid(),
            DriverId = driverId.Value,
            CarId = carId,
            Text = request.Text.Trim(),
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
            status = (int)repair.Status,
            statusName = "Новая",
            adminComment = string.Empty,
            createdAt = repair.CreatedAt.ToString("o")
        });
    }

    [AllowAnonymous]
    [HttpGet("/download-apk")]
    [HttpGet("/apk")]
    [HttpGet("apk")]
    [HttpGet("/download/app")]
    [HttpGet("/app.apk")]
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
        return PhysicalFile(path, "application/vnd.android.package-archive", "luna2000.apk");
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
            version = "1.0.7",
            versionCode = 8,
            downloadUrl = "/download-apk",
            changelog = "Новый фирменный ярлык приложения и логотип (белая Skoda Rapid на фоне луны)"
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
}
