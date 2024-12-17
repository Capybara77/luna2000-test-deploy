using AutoMapper;
using luna2000.Data;
using luna2000.Dto;
using luna2000.Models;
using luna2000.Service;
using luna2000.Telegram;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace luna2000.Controllers;

[Authorize]
public class DriverController : Controller
{
    private readonly LunaDbContext _dbContext;
    private readonly IMapper _mapper;
    private readonly IFileStorage _fileStorage;
    private readonly ITelegramClient _telegramClient;

    public DriverController(LunaDbContext dbContext, IMapper mapper, IFileStorage fileStorage,
        ITelegramClient telegramClient)
    {
        _dbContext = dbContext;
        _mapper = mapper;
        _fileStorage = fileStorage;
        _telegramClient = telegramClient;
    }

    public IActionResult Index()
    {
        var drivers = _dbContext.Set<DriverEntity>()
            .Include(d => d.Photos)
            .AsNoTracking()
            .ToArray();

        return View(drivers);
    }

    [HttpGet]
    public IActionResult Add()
    {
        return View();
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromForm] AddDriverRequest request)
    {
        var driver = _mapper.Map<DriverEntity>(request);
        driver.Photos = new List<PhotoEntity>();

        if (request.Photos != null)
        {
            foreach (var photo in request.Photos)
            {
                await using var memStream = new MemoryStream();
                await photo.CopyToAsync(memStream);
                var driverPhoto = _mapper.Map<IFormFile, PhotoEntity>(photo);

                var fileId = await _fileStorage.SaveFileAsync(memStream.ToArray(), driverPhoto.FileExtension);

                driverPhoto.FileId = fileId;

                driver.Photos.Add(driverPhoto);
            }
        }

        var aliases = GetAliases(request, driver);

        await _dbContext.AddAsync(driver);
        await _dbContext.AddRangeAsync(aliases);
        await _dbContext.SaveChangesAsync();

        return Ok(new { success = true });
    }

    private static IEnumerable<AliasEntity>? GetAliases(AddDriverRequest request, DriverEntity driver)
    {
        var aliases = request.Aliases?.Split("\n")
            .Distinct()
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s.Replace("\r", string.Empty))
            .Select(s => new AliasEntity
        {
            Alias = s,
            Driver = driver
        });

        return aliases;
    }

    [HttpDelete]
    [Route("/driver/delete/{id}")]
    public IActionResult Delete(Guid id)
    {
        var driver = _dbContext.Set<DriverEntity>()
            .Include(driverEntity => driverEntity.Photos)
            .FirstOrDefault(entity => entity.Id == id);

        if (driver == null)
        {
            return NotFound();
        }

        DeleteDriverPhotos(driver.Photos);

        _dbContext.Remove(driver);
        _dbContext.SaveChanges();

        return Ok(new { success = true });
    }

    [HttpGet]
    public IActionResult Edit(Guid id)
    {
        var driver = _dbContext.Set<DriverEntity>()
            .Include(entity => entity.Photos)
            .Include(entity => entity.Aliases)
            .AsNoTracking()
            .FirstOrDefault(entity => entity.Id == id);

        if (driver == null)
        {
            return NotFound();
        }

        return View(driver);
    }

    [HttpPost]
    [Route("/driver/edit/{id}")]
    public async Task<IActionResult> Edit(AddDriverRequest request)
    {
        var driver = await _dbContext.Set<DriverEntity>()
            .Include(entity => entity.Aliases)
            .Include(entity => entity.Photos)
            .FirstOrDefaultAsync(entity => entity.Id == request.Id);

        if (driver == null)
        {
            return NotFound();
        }

        _mapper.Map(request, driver);

        if (request.Photos != null && request.Photos.Count != 0)
        {
            DeleteDriverPhotos(driver.Photos);
            driver.Photos = new List<PhotoEntity>();

            foreach (var photo in request.Photos)
            {
                await using var memStream = new MemoryStream();
                await photo.CopyToAsync(memStream);
                var driverPhoto = _mapper.Map<IFormFile, PhotoEntity>(photo);

                var fileId = await _fileStorage.SaveFileAsync(memStream.ToArray(), driverPhoto.FileExtension);

                driverPhoto.FileId = fileId;

                driver.Photos.Add(driverPhoto);
            }
        }

        var aliases = GetAliases(request, driver);

        _dbContext.RemoveRange(driver.Aliases);
        _dbContext.AddRangeAsync(aliases);
        await _dbContext.SaveChangesAsync();

        return Ok(new { success = true });
    }

    [HttpGet]
    public async Task<IActionResult> AddBalance(Guid driverId)
    {
        var driver = await _dbContext.Set<DriverEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.Id == driverId);

        if (driver == null) { return NotFound(); }

        return View(driver);
    }

    [HttpPost]
    public async Task<IActionResult> AddBalance(Guid driverId, decimal balance)
    {
        var driver = await _dbContext.Set<DriverEntity>()
            .FirstOrDefaultAsync(entity => entity.Id == driverId);

        if (driver == null) { return NotFound(); }

        driver.Balance += balance;
        await _dbContext.SaveChangesAsync();

        return LocalRedirect("/");
    }

    [HttpGet]
    [Route("/driver/createtgurl/{id:guid}")]
    public async Task<IActionResult> CreateTgUrl(Guid id)
    {
        var driverId = await _dbContext.Drivers
            .Select(entity => entity.Id)
            .FirstOrDefaultAsync();

        if (driverId == Guid.Empty)
        {
            return NotFound();
        }

        var url = _telegramClient.CreateUrlInvite(driverId);

        return Json(new { success = true, url });
    }

    private void DeleteDriverPhotos(ICollection<PhotoEntity>? photos)
    {
        if (photos == null)
        {
            return;
        }

        foreach (var photo in photos)
        {
            _fileStorage.DeleteFile(photo.FileId);
        }
    }
}