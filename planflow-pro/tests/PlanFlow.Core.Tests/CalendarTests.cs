using PlanFlow.Core.Calendars;
using Xunit;

namespace PlanFlow.Core.Tests;

public class CalendarTests
{
    [Fact]
    public void Build_CreatesWorkweekAndHolidaySkippingCalendar()
    {
        var library = new CalendarLibrary();
        var friday = new DateTime(2026, 1, 2); // a Friday
        var holiday = new DateTime(2026, 1, 5); // a Monday public holiday

        var calendar = library.Build(new CalendarDefinition
        {
            CalendarId = "CAL1",
            Country = "SA",
            WorkWeek = new[] { DayOfWeek.Sunday, DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday },
            PublicHolidays = new[] { holiday }
        });

        Assert.False(calendar.IsWorkingDay(friday));
        Assert.False(calendar.IsWorkingDay(holiday));
        Assert.True(calendar.IsWorkingDay(new DateTime(2026, 1, 4))); // Sunday
    }

    [Fact]
    public void HoursFor_RamadanPeriod_UsesReducedHours()
    {
        var calendar = new CalendarLibrary().Build(new CalendarDefinition
        {
            CalendarId = "CAL1",
            DailyHours = 8,
            RamadanDailyHours = 6,
            RamadanPeriods = new[] { (new DateTime(2026, 3, 1), new DateTime(2026, 3, 30)) }
        });

        var duringRamadan = new DateTime(2026, 3, 15);
        Assert.Equal(6m, calendar.HoursFor(duringRamadan));
    }

    [Fact]
    public void AddWorkingDays_SkipsNonWorkingDays()
    {
        var calendar = new CalendarLibrary().Build(new CalendarDefinition { CalendarId = "CAL1" });
        var sunday = new DateTime(2026, 1, 4); // Sunday, a working day
        var result = calendar.AddWorkingDays(sunday, 5);

        Assert.True(calendar.IsWorkingDay(result));
        // CountWorkingDays is inclusive of both endpoints; 5 forward working-day steps
        // from a working day lands on the 6th working day counting the start itself.
        Assert.Equal(6, calendar.CountWorkingDays(sunday, result));
    }
}
