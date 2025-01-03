namespace luna2000.Dto;

public class RentalScheduleView
{
    public Guid Id { get; set; }

    public string FullName { get; set; }

    public string CarName { get; set; }

    public List<DayOfWeekStatus> WeekdayStatuses { get; set; } = new List<DayOfWeekStatus>();
}

public class DayOfWeekStatus
{
    public DayOfWeek DayOfWeek { get; set; }

    public bool IsActive { get; set; }
}