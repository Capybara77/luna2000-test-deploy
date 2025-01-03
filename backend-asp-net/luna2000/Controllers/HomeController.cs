using luna2000.Models;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using luna2000.Data;
using luna2000.Dto;
using luna2000.Options;
using luna2000.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace luna2000.Controllers;

[Authorize]
public class HomeController : Controller
{
    private readonly LunaDbContext _dbContext;
    private readonly IDeductRentService _deductRentService;
    private readonly IJobServerService _jobServerService;
    private readonly CommonDataConfiguration _commonOptions;
    private readonly JobServerConfiguration _jobServerConfiguration;

    public HomeController(LunaDbContext dbContext, IDeductRentService deductRentService,
        IJobServerService jobServerService, IOptions<JobServerConfiguration> jobServerConfiguration,
        IOptions<CommonDataConfiguration> commonOptions)
    {
        _dbContext = dbContext;
        _deductRentService = deductRentService;
        _jobServerService = jobServerService;
        _commonOptions = commonOptions.Value;
        _jobServerConfiguration = jobServerConfiguration.Value;
    }

    public async Task<IActionResult> Index()
    {
        var cars = await _dbContext.Set<CarEntity>()
            .AsNoTracking()
            .ToArrayAsync();

        var carRental = await _dbContext.Set<CarRentalEntity>()
            .Include(entity => entity.Car)
            .Include(entity => entity.Driver)
            .Include(entity => entity.Schedules)
            .AsNoTracking()
            .ToArrayAsync();

        var monthProfit = GetMonthProfit(carRental);

        var mainDto = new MainViewDto
        {
            Cars = cars,
            Drivers = await _dbContext.Set<DriverEntity>()
                .AsNoTracking()
                .ToArrayAsync(),
            Rentals = carRental,
            StatsDto = new()
            {
                ActiveDrivers = carRental
                    .Select(entity => entity.DriverId)
                    .Distinct()
                    .Count(),
                CarsInRent = carRental
                    .Select(entity => entity.CarId)
                    .Distinct()
                    .Count(),
                CarsCount = cars.Length,
                MonthProfit = Math.Round(monthProfit, 1)
            }
        };

        try
        {
            mainDto.IsJobEnable = await _jobServerService.IsJobExists(_jobServerConfiguration.JobId);
        }
        catch
        {
            mainDto.IsJobServerDown = true;
        }

        return View(mainDto);
    }

    [HttpPost]
    public IActionResult DeletePair([FromBody] Guid pairId)
    {
        var carRental = _dbContext.Set<CarRentalEntity>()
            .FirstOrDefault(entity => entity.Id == pairId);

        if (carRental == null)
        {
            return NotFound();
        }

        _dbContext.Set<CarRentalEntity>()
            .Remove(carRental);
        _dbContext.SaveChanges();

        return Ok();
    }

    [HttpPost]
    public IActionResult AddRent([FromBody] AddRentRequest addRentRequest)
    {
        var rentId = Guid.NewGuid();

        _dbContext.Set<CarRentalEntity>()
            .Add(new CarRentalEntity()
            {
                Id = rentId,
                DriverId = addRentRequest.DriverId,
                CarId = addRentRequest.CarId,
                Rent = addRentRequest.Rent
            });

        _dbContext.Set<RentScheduleEntity>()
            .AddRangeAsync(Enum.GetValues<DayOfWeek>().Select(dayOfWeek => new RentScheduleEntity
            {
                RentId = rentId,
                DayOfWeek = dayOfWeek
            }));

        _dbContext.SaveChanges();

        return Ok();
    }

    [HttpPost]
    public IActionResult UpdateRent([FromBody] UpdateRentRequest request)
    {
        var carRental = _dbContext.Set<CarRentalEntity>()
            .FirstOrDefault(entity => entity.Id == request.EditRentId);

        if (carRental == null)
        {
            return NotFound();
        }

        carRental.Rent = request.Rent;
        _dbContext.SaveChanges();

        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> ChangeJobStatus(bool newStatus)
    {
        if (newStatus)
        {
            await _jobServerService.EnableJob();
        }
        else
        {
            await _jobServerService.DisableJob(_jobServerConfiguration.JobId);
        }

        return LocalRedirect("/");
    }

    public async Task<IActionResult> DeductRent()
    {
        await _deductRentService.DeductRent();

        return Ok();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }

    [HttpGet]
    public async Task<IActionResult> EditSchedule(Guid rentId)
    {
        var rental = await _dbContext.Set<CarRentalEntity>()
            .Include(entity => entity.Driver)
            .Include(entity => entity.Car)
            .Include(entity => entity.Schedules)
            .AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.Id == rentId);

        if (rental == null)
        {
            return NotFound();
        }

        return View(new RentalScheduleView
        {
            Id = rentId,
            CarName = $"{rental.Car!.BrandModel} ({rental.Car.PlateNumber})",
            FullName = rental.Driver!.Fio,
            WeekdayStatuses = rental.Schedules.Select(entity => new DayOfWeekStatus
            {
                DayOfWeek = entity.DayOfWeek,
                IsActive = true
            }).ToList()
        });
    }

    [HttpPost]
    public async Task<IActionResult> SaveSchedule(RentalScheduleDto model)
    {
        model.WeekdayStatuses = model.WeekdayStatuses.DistinctBy(status => status.DayOfWeek).ToList();

        var rent = await _dbContext.Set<CarRentalEntity>()
            .Include(entity => entity.Schedules)
            .FirstOrDefaultAsync(entity => entity.Id == model.Id);

        if (rent == null)
        {
            return NotFound();
        }

        var scheduleDays = model.WeekdayStatuses
            .Distinct()
            .Where(status => status.IsActive)
            .Select(status => new RentScheduleEntity
            {
                Id = Guid.NewGuid(),
                RentId = rent.Id,
                DayOfWeek = status.DayOfWeek
            }).ToList();

        _dbContext.RemoveRange(rent.Schedules!);
        await _dbContext.AddRangeAsync(scheduleDays);
        await _dbContext.SaveChangesAsync();

        return RedirectToAction("Index");
    }

    private decimal GetMonthProfit(CarRentalEntity[] carRental)
    {
        var currentDate = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow,
            TimeZoneInfo.FindSystemTimeZoneById(_commonOptions.TimeZone));
        var daysInMonth = DateTime.DaysInMonth(currentDate.Year, currentDate.Month);

        decimal monthProfit = 0;

        foreach (var rental in carRental)
        {
            decimal rentalProfit = 0;
            for (var day = 1; day <= daysInMonth; day++)
            {
                var currentDay = new DateTime(currentDate.Year, currentDate.Month, day);
                var isScheduled = rental.Schedules!.Any(s => s.DayOfWeek == currentDay.DayOfWeek);

                if (isScheduled)
                {
                    rentalProfit += rental.Rent;
                }
            }
            monthProfit += rentalProfit;
        }

        return monthProfit;
    }
}