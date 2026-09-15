namespace PlanFlow.Core.Calendars;

/// <summary>Input to the Calendar Builder wizard.</summary>
public sealed class CalendarDefinition
{
    public string CalendarId { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public IReadOnlyList<DayOfWeek> WorkWeek { get; set; } = new[]
    {
        DayOfWeek.Sunday, DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday
    };
    public decimal DailyHours { get; set; } = 8m;
    public decimal RamadanDailyHours { get; set; } = 6m;
    public IReadOnlyList<DateTime> PublicHolidays { get; set; } = Array.Empty<DateTime>();
    public IReadOnlyList<(DateTime Start, DateTime End)> RamadanPeriods { get; set; } = Array.Empty<(DateTime, DateTime)>();
    public IReadOnlyList<DateTime> CustomExceptions { get; set; } = Array.Empty<DateTime>();
}

/// <summary>Builds a <see cref="ProjectCalendar"/> and keeps a keyed library of them (Calendar Library sheet).</summary>
public sealed class CalendarLibrary
{
    private readonly Dictionary<string, ProjectCalendar> _calendars = new(StringComparer.OrdinalIgnoreCase);

    public ProjectCalendar Build(CalendarDefinition definition)
    {
        var calendar = new ProjectCalendar
        {
            CalendarId = definition.CalendarId,
            Country = definition.Country,
            WorkingDays = new HashSet<DayOfWeek>(definition.WorkWeek),
            DailyHours = definition.DailyHours,
            RamadanDailyHours = definition.RamadanDailyHours
        };

        foreach (var holiday in definition.PublicHolidays) calendar.PublicHolidays.Add(holiday.Date);
        foreach (var exception in definition.CustomExceptions) calendar.CustomNonWorkingDays.Add(exception.Date);
        foreach (var period in definition.RamadanPeriods) calendar.RamadanPeriods.Add((period.Start.Date, period.End.Date));

        _calendars[definition.CalendarId] = calendar;
        return calendar;
    }

    public ProjectCalendar? Get(string calendarId) => _calendars.TryGetValue(calendarId, out var c) ? c : null;
    public IReadOnlyCollection<ProjectCalendar> All => _calendars.Values;
}
