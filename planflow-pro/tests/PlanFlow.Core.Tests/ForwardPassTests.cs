using PlanFlow.Core.Calendars;
using PlanFlow.Core.Domain;
using PlanFlow.Core.Scheduling;
using Xunit;

namespace PlanFlow.Core.Tests;

public class ForwardPassTests
{
    private static ProjectCalendar SevenDayCalendar() => new CalendarLibrary().Build(new CalendarDefinition
    {
        CalendarId = "CAL1",
        WorkWeek = new[]
        {
            DayOfWeek.Sunday, DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday,
            DayOfWeek.Thursday, DayOfWeek.Friday, DayOfWeek.Saturday
        }
    });

    [Fact]
    public void Run_TwoActivitiesInSeries_SecondStartsAfterFirstFinishes()
    {
        var calendar = SevenDayCalendar();
        var activities = new List<Activity>
        {
            new() { ActivityId = "A1", Duration = 5 },
            new() { ActivityId = "A2", Duration = 3 },
        };
        var relationships = new List<Relationship> { new() { RelationshipId = "R1", PredecessorId = "A1", SuccessorId = "A2", RelationshipType = RelationshipType.FS } };

        var validation = new ForwardPassEngine().Run(activities, relationships,
            new Dictionary<string, ProjectCalendar> { ["CAL1"] = calendar }, calendar, new DateTime(2026, 1, 1));

        Assert.True(validation.IsValid);
        Assert.NotNull(activities[0].EarlyStart);
        Assert.NotNull(activities[1].EarlyStart);
        Assert.True(activities[1].EarlyStart >= activities[0].EarlyFinish);
        Assert.True(activities[0].IsCritical);
        Assert.True(activities[1].IsCritical);
    }

    [Fact]
    public void Run_ParallelActivity_HasPositiveFloat()
    {
        var calendar = SevenDayCalendar();
        var activities = new List<Activity>
        {
            new() { ActivityId = "A1", Duration = 10 },
            new() { ActivityId = "A2", Duration = 2 }, // shorter parallel path, should have float
            new() { ActivityId = "A3", Duration = 1 },
        };
        var relationships = new List<Relationship>
        {
            new() { RelationshipId = "R1", PredecessorId = "A1", SuccessorId = "A3", RelationshipType = RelationshipType.FS },
            new() { RelationshipId = "R2", PredecessorId = "A2", SuccessorId = "A3", RelationshipType = RelationshipType.FS },
        };

        new ForwardPassEngine().Run(activities, relationships,
            new Dictionary<string, ProjectCalendar> { ["CAL1"] = calendar }, calendar, new DateTime(2026, 1, 1));

        Assert.False(activities[1].IsCritical);
        Assert.True(activities[1].TotalFloat > 0);
    }

    [Fact]
    public void Run_CircularNetwork_ReturnsInvalidWithoutCrashing()
    {
        var calendar = SevenDayCalendar();
        var activities = new List<Activity> { new() { ActivityId = "A1" }, new() { ActivityId = "A2" } };
        var relationships = new List<Relationship>
        {
            new() { RelationshipId = "R1", PredecessorId = "A1", SuccessorId = "A2" },
            new() { RelationshipId = "R2", PredecessorId = "A2", SuccessorId = "A1" },
        };

        var validation = new ForwardPassEngine().Run(activities, relationships,
            new Dictionary<string, ProjectCalendar> { ["CAL1"] = calendar }, calendar, new DateTime(2026, 1, 1));

        Assert.False(validation.IsValid);
    }
}
