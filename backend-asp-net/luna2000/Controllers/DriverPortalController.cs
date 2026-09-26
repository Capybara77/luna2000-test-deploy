using luna2000.Data;
using luna2000.Models;
using luna2000.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace luna2000.Controllers;

/// <summary>
/// Портал водителя: только свой баланс, своя история, общий чат.
/// Роль: Driver.
/// </summary>
[Authorize(Roles = "Driver")]
[Route("driver-portal")]
public class DriverPortalController : Controller
{
    private readonly LunaDbContext _db;
    private readonly CommonDataConfiguration _commonOptions;

    public DriverPortalController(LunaDbContext db, IOptions<CommonDataConfiguration> opts)
    {
        _db = db;
        _commonOptions = opts.Value;
    }

    private Guid? GetDriverId()
    {
        var claim = User.FindFirst("driverId")?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    // GET /driver-portal — баланс
    [HttpGet("")]
    public async Task<IActionResult> Index()
    {
        var driverId = GetDriverId();
        if (driverId == null) return Forbid();

        var driver = await _db.Drivers.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == driverId);

        if (driver == null) return NotFound();

        // История операций за 30 дней
        var since = DateTime.UtcNow.AddDays(-30);
        var logs = await _db.BaseLogs
            .Where(l => l.EntryId == driverId
                && (l.ObjectName == "DeductRent" || l.ObjectName == "SmsBalance")
                && l.Created >= since)
            .OrderByDescending(l => l.Created)
            .Take(30)
            .AsNoTracking()
            .ToListAsync();

        var tz = TimeZoneInfo.FindSystemTimeZoneById(_commonOptions.TimeZone);

        ViewBag.Driver = driver;
        ViewBag.Logs = logs;
        ViewBag.TimeZone = tz;
        return View();
    }

    // GET /driver-portal/history — полная история водителя
    [HttpGet("history")]
    public async Task<IActionResult> History(int page = 1)
    {
        var driverId = GetDriverId();
        if (driverId == null) return Forbid();

        const int pageSize = 50;

        var total = await _db.BaseLogs
            .CountAsync(l => l.EntryId == driverId);

        var logs = await _db.BaseLogs
            .Where(l => l.EntryId == driverId)
            .OrderByDescending(l => l.Created)
            .Skip(pageSize * (page - 1))
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync();

        var tz = TimeZoneInfo.FindSystemTimeZoneById(_commonOptions.TimeZone);

        ViewBag.Logs = logs;
        ViewBag.Page = page;
        ViewBag.TotalPages = (int)Math.Ceiling((double)total / pageSize);
        ViewBag.TimeZone = tz;

        return View();
    }

    // GET /driver-portal/chat — общий чат
    [HttpGet("chat")]
    public async Task<IActionResult> Chat()
    {
        var driverId = GetDriverId();
        if (driverId == null) return Forbid();

        var driver = await _db.Drivers.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == driverId);

        // Последние 50 сообщений общего чата
        var messages = await _db.ChatMessages
            .Include(m => m.Driver)
            .Where(m => m.Channel == ChatChannel.General)
            .OrderByDescending(m => m.CreatedAt)
            .Take(50)
            .AsNoTracking()
            .ToListAsync();

        var tz = TimeZoneInfo.FindSystemTimeZoneById(_commonOptions.TimeZone);

        ViewBag.Driver = driver;
        ViewBag.Messages = messages.OrderBy(m => m.CreatedAt).ToList();
        ViewBag.TimeZone = tz;

        return View();
    }
}
