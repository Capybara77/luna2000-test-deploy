using luna2000.Data;
using luna2000.Models;
using luna2000.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace luna2000.Controllers;

/// <summary>
/// Управление заявками на ремонт автомобилей от водителей.
/// Доступно только Администраторам и Редакторам.
/// </summary>
[Authorize(Roles = "Admin,Editor")]
[Route("repairs")]
public class RepairController : Controller
{
    private readonly LunaDbContext _db;
    private readonly CommonDataConfiguration _commonOptions;

    public RepairController(LunaDbContext db, IOptions<CommonDataConfiguration> options)
    {
        _db = db;
        _commonOptions = options.Value;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(int? status = null)
    {
        var allQuery = _db.RepairRequests
            .Include(r => r.Driver)
            .Include(r => r.Car)
            .AsNoTracking();

        var allList = await allQuery
            .OrderByDescending(r => r.CreatedAt)
            .Take(200)
            .ToListAsync();

        ViewBag.CountAll = allList.Count;
        ViewBag.CountNew = allList.Count(r => r.Status == RepairStatus.New);
        ViewBag.CountInProgress = allList.Count(r => r.Status == RepairStatus.InProgress);
        ViewBag.CountDone = allList.Count(r => r.Status == RepairStatus.Done);
        ViewBag.CountRejected = allList.Count(r => r.Status == RepairStatus.Rejected);

        var list = status.HasValue && status.Value >= 0 && status.Value <= 3
            ? allList.Where(r => (int)r.Status == status.Value).ToList()
            : allList;

        var tz = TimeZoneInfo.FindSystemTimeZoneById(_commonOptions.TimeZone);

        ViewBag.CurrentStatus = status;
        ViewBag.TimeZone = tz;
        ViewBag.AllRequests = allList;

        return View(list);
    }

    [HttpPost("update-status")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> UpdateStatus()
    {
        Guid reqId = Guid.Empty;
        int reqStatus = 0;
        string? reqComment = null;

        // Читаем из Form или JSON
        if (Request.HasFormContentType && Request.Form.ContainsKey("id"))
        {
            Guid.TryParse(Request.Form["id"], out reqId);
            if (Request.Form.ContainsKey("status") && int.TryParse(Request.Form["status"], out var s))
                reqStatus = s;
            if (Request.Form.ContainsKey("comment"))
                reqComment = Request.Form["comment"];
        }
        else if (Request.ContentType?.Contains("application/json") == true)
        {
            using var reader = new System.IO.StreamReader(Request.Body);
            var body = await reader.ReadToEndAsync();
            if (!string.IsNullOrEmpty(body))
            {
                using var doc = System.Text.Json.JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("id", out var idProp))
                    Guid.TryParse(idProp.GetString(), out reqId);
                if (doc.RootElement.TryGetProperty("status", out var stProp))
                    reqStatus = stProp.GetInt32();
                if (doc.RootElement.TryGetProperty("comment", out var cmProp))
                    reqComment = cmProp.GetString();
            }
        }
        else
        {
            if (Request.Query.ContainsKey("id")) Guid.TryParse(Request.Query["id"], out reqId);
            if (Request.Query.ContainsKey("status") && int.TryParse(Request.Query["status"], out var s)) reqStatus = s;
            if (Request.Query.ContainsKey("comment")) reqComment = Request.Query["comment"];
        }

        if (reqId == Guid.Empty)
            return BadRequest(new { error = "Некорректный ID заявки" });

        var item = await _db.RepairRequests.FindAsync(reqId);
        if (item == null)
            return NotFound(new { error = "Заявка не найдена" });

        item.Status = (RepairStatus)reqStatus;
        if (reqComment != null) item.AdminComment = reqComment.Trim();
        item.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        if (Request.Headers["X-Requested-With"] == "XMLHttpRequest" ||
            Request.Headers["Accept"].ToString().Contains("application/json") ||
            Request.ContentType?.Contains("application/json") == true)
        {
            return Ok(new
            {
                success = true,
                id = item.Id.ToString(),
                status = (int)item.Status,
                statusName = item.Status switch
                {
                    RepairStatus.New => "Новая",
                    RepairStatus.InProgress => "В работе",
                    RepairStatus.Done => "Выполнена",
                    RepairStatus.Rejected => "Отклонена",
                    _ => "Новая"
                },
                comment = item.AdminComment
            });
        }

        return LocalRedirect("/repairs");
    }

    [HttpPost("delete")]
    [Authorize(Roles = "Admin,Editor")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> Delete([FromForm] Guid? id)
    {
        Guid targetId = id ?? Guid.Empty;
        if (targetId == Guid.Empty && Request.Query.ContainsKey("id"))
        {
            Guid.TryParse(Request.Query["id"], out targetId);
        }
        if (targetId == Guid.Empty && Request.HasFormContentType && Request.Form.ContainsKey("id"))
        {
            Guid.TryParse(Request.Form["id"], out targetId);
        }

        if (targetId != Guid.Empty)
        {
            var item = await _db.RepairRequests.FindAsync(targetId);
            if (item != null)
            {
                _db.RepairRequests.Remove(item);
                await _db.SaveChangesAsync();
            }
        }

        if (Request.Headers["X-Requested-With"] == "XMLHttpRequest" ||
            Request.Headers["Accept"].ToString().Contains("application/json") ||
            Request.ContentType?.Contains("application/json") == true)
        {
            return Ok(new { success = true, id = targetId.ToString() });
        }

        return LocalRedirect("/repairs");
    }
}
