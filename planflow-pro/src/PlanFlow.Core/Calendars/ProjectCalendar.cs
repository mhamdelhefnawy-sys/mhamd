namespace PlanFlow.Core.Calendars;

/// <summary>
/// A named calendar: which days of the week are worked, daily hours, and date-specific
/// exceptions (public holidays, Ramadan-hours windows, or arbitrary custom overrides).
/// Backs Calendars/Calendar Library — dates are computed from this, never from raw
/// Excel serial-date arithmetic, so a custom calendar always wins.
/// Uses DateTime (date component only, always compared via .Date) rather than DateOnly
/// so PlanFlow.Core keeps building on net48, which predates DateOnly.
/// </summary>
public sealed class ProjectCalendar
{
    public string CalendarId { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public HashSet<DayOfWeek> WorkingDays { get; set; } = new(new[]
    {
        DayOfWeek.Sunday, DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday
    });
    public decimal DailyHours { get; set; } = 8m;
    public decimal RamadanDailyHours { get; set; } = 6m;

    public HashSet<DateTime> PublicHolidays { get; } = new();
    public HashSet<DateTime> CustomNonWorkingDays { get; } = new();
    public List<(DateTime Start, DateTime End)> RamadanPeriods { get; } = new();

    public bool IsWorkingDay(DateTime date)
    {
        date = date.Date;
        if (!WorkingDays.Contains(date.DayOfWeek)) return false;
        if (PublicHolidays.Contains(date)) return false;
        if (CustomNonWorkingDays.Contains(date)) return false;
        return true;
    }

    public decimal HoursFor(DateTime date)
    {
        date = date.Date;
        if (!IsWorkingDay(date)) return 0m;
        return RamadanPeriods.Any(p => date >= p.Start.Date && date <= p.End.Date) ? RamadanDailyHours : DailyHours;
    }

    /// <summary>Advances from <paramref name="start"/> by <paramref name="workingDays"/> working days
    /// (0 returns the start date itself if it's a working day, otherwise the next working day).</summary>
    public DateTime AddWorkingDays(DateTime start, int workingDays)
    {
        var date = start.Date;
        if (workingDays == 0)
        {
            while (!IsWorkingDay(date)) date = date.AddDays(1);
            return date;
        }

        var remaining = workingDays;
        var step = remaining > 0 ? 1 : -1;
        while (remaining != 0)
        {
            date = date.AddDays(step);
            if (IsWorkingDay(date)) remaining -= step;
        }
        return date;
    }

    public int CountWorkingDays(DateTime start, DateTime end)
    {
        start = start.Date;
        end = end.Date;
        if (end < start) return -CountWorkingDays(end, start);
        var count = 0;
        for (var d = start; d <= end; d = d.AddDays(1))
            if (IsWorkingDay(d)) count++;
        return count;
    }
}
