namespace luna2000.Dto;

public class ViewHistoryDto
{
    public IEnumerable<IGrouping<Guid, luna2000.Dto.HistoryDto>> Items { get; set; }

    public int ItemsPerPage { get; set; }

    public int CurrentPage { get; set; }

    public int ItemsCount { get; set; }

    public Guid? ObjFilterId { get; set; }
}