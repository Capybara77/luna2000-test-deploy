namespace luna2000.Dto;

public class RentalScheduleDto
{
    public Guid Id { get; set; }

    public List<DayOfWeekStatus> WeekdayStatuses { get; set; } = new();
}
