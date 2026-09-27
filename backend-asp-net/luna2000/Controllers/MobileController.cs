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
        if (!Guid.TryParse(request.DriverId, out var driverId))
            return BadRequest(new { error = "Неверный формат driverId" });

        var driver = await _db.Drivers.AsNoTracking().FirstOrDefaultAsync(d => d.Id == driverId);
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
    // GET /mobile/balance
    // Returns balance + last 30 days operations
    // ──────────────────────────────────────────────
    [HttpGet("balance")]
    [Authorize(AuthenticationSchemes = "MobileJwt")]
    public async Task<IActionResult> Balance()
    {
        var driverId = GetDriverId();
        if (driverId == null) return Unauthorized();

        var driver = await _db.Drivers.AsNoTracking().FirstOrDefaultAsync(d => d.Id == driverId);
        if (driver == null) return NotFound();

        // История операций за последние 30 дней (списания + пополнения)
        var since = DateTime.UtcNow.AddDays(-30);
        var logs = await _db.BaseLogs
            .Where(l => l.EntryId == driverId
                && (l.ObjectName == "DeductRent" || l.ObjectName == "SmsBalance")
                && l.Created >= since)
            .OrderByDescending(l => l.Created)
            .Take(60)
            .AsNoTracking()
            .ToListAsync();

        var operations = logs.Select(l => new
        {
            type = l.ObjectName,
            note = l.Note,
            createdAt = l.Created,
            isDebit = l.ObjectName == "DeductRent"
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
            id = m.Id,
            driverId = m.DriverId,
            driverName = m.Driver?.Fio ?? "Неизвестный",
            channel = m.Channel,
            text = m.Text,
            createdAt = m.CreatedAt
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

    [AllowAnonymous]
    [HttpGet("/download-apk")]
    [HttpGet("/apk")]
    [HttpGet("apk")]
    public IActionResult DownloadApk([FromServices] IWebHostEnvironment env)
    {
        var path = Path.Combine(env.WebRootPath, "apk", "luna2000.apk");
        if (!System.IO.File.Exists(path))
        {
            var fallback = Path.Combine(env.ContentRootPath, "..", "..", "luna2000-driver.apk");
            if (System.IO.File.Exists(fallback)) path = fallback;
            else return NotFound("APK не найден на сервере.");
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
            version = "1.0.0",
            versionCode = 1,
            downloadUrl = "/download-apk",
            changelog = "Релиз с постоянной цифровой подписью и поддержкой обновлений"
        });
    }
}

public class MobileAuthRequest
{
    public string DriverId { get; set; } = string.Empty;
}
