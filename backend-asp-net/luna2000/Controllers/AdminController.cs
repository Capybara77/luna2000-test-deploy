using luna2000.Data;
using luna2000.Models;
using luna2000.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace luna2000.Controllers;

/// <summary>
/// Админ-панель: управление пользователями, ролями, паролями.
/// </summary>
[Authorize(Roles = "Admin,Editor")]
[Route("admin")]
public class AdminController : Controller
{
    private readonly LunaDbContext _db;

    public AdminController(LunaDbContext db)
    {
        _db = db;
    }

    // GET /admin — список всех пользователей
    [HttpGet("")]
    public async Task<IActionResult> Index()
    {
        var users = await _db.Set<UserEntity>()
            .Include(u => u.Driver)
            .AsNoTracking()
            .OrderBy(u => u.Role)
            .ThenBy(u => u.Name)
            .ToListAsync();

        return View(users);
    }

    // GET /admin/create — форма создания пользователя
    [HttpGet("create")]
    public async Task<IActionResult> Create()
    {
        ViewBag.Drivers = await _db.Drivers.AsNoTracking()
            .OrderBy(d => d.Fio).ToListAsync();
        return View();
    }

    // POST /admin/create
    [HttpPost("create")]
    public async Task<IActionResult> Create([FromForm] CreateUserRequest request)
    {
        var login = request.Login?.Trim();
        var password = request.Password?.Trim();

        if (string.IsNullOrEmpty(login) || string.IsNullOrEmpty(password))
        {
            TempData["Error"] = "Логин и пароль обязательны";
            return RedirectToAction(nameof(Create));
        }

        if (await _db.Set<UserEntity>().AnyAsync(u => u.Login == login))
        {
            TempData["Error"] = $"Логин '{login}' уже занят";
            return RedirectToAction(nameof(Create));
        }

        var user = new UserEntity
        {
            Id = Guid.NewGuid(),
            Name = request.Name ?? login,
            Login = login,
            Password = password,
            Role = request.Role,
            DriverId = request.DriverId == Guid.Empty ? null : request.DriverId
        };

        _db.Set<UserEntity>().Add(user);
        await _db.SaveChangesAsync();

        TempData["Success"] = $"Пользователь '{login}' создан";
        return RedirectToAction(nameof(Index));
    }

    // POST /admin/edit — изменение логина / пароля / роли
    [HttpPost("edit")]
    public async Task<IActionResult> Edit([FromBody] EditUserRequest request)
    {
        var user = await _db.Set<UserEntity>().FindAsync(request.Id);
        if (user == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(request.Login))
        {
            if (await _db.Set<UserEntity>().AnyAsync(u => u.Login == request.Login && u.Id != request.Id))
                return BadRequest(new { error = "Логин уже занят" });
            user.Login = request.Login.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Password))
            user.Password = request.Password.Trim();

        if (!string.IsNullOrWhiteSpace(request.Name))
            user.Name = request.Name.Trim();

        if (request.Role.HasValue)
            user.Role = request.Role.Value;

        await _db.SaveChangesAsync();
        return Ok(new { success = true, login = user.Login });
    }

    // POST /admin/delete/{id}
    [HttpPost("delete/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var user = await _db.Set<UserEntity>().FindAsync(id);
        if (user == null) return NotFound();

        _db.Set<UserEntity>().Remove(user);
        await _db.SaveChangesAsync();

        TempData["Success"] = "Пользователь удалён";
        return RedirectToAction(nameof(Index));
    }

    // POST /admin/generate-password/{id} — сгенерировать новый пароль
    [HttpPost("generate-password/{id:guid}")]
    public async Task<IActionResult> GeneratePassword(Guid id)
    {
        var user = await _db.Set<UserEntity>().FindAsync(id);
        if (user == null) return NotFound();

        var pwd = UserHelper.GeneratePassword();
        user.Password = pwd;
        await _db.SaveChangesAsync();

        return Ok(new { password = pwd });
    }
}

public class CreateUserRequest
{
    public string? Name { get; set; }
    public string? Login { get; set; }
    public string? Password { get; set; }
    public UserRole Role { get; set; } = UserRole.Editor;
    public Guid? DriverId { get; set; }
}

public class EditUserRequest
{
    public Guid Id { get; set; }
    public string? Name { get; set; }
    public string? Login { get; set; }
    public string? Password { get; set; }
    public UserRole? Role { get; set; }
}
