using PlanFlow.Core.Common;
using PlanFlow.Core.Domain;
using PlanFlow.Core.Logic;
using Xunit;

namespace PlanFlow.Core.Tests;

public class LogicSuggestionTests
{
    private static Func<string> IdSequence()
    {
        var i = 0;
        return () => $"R{++i}";
    }

    [Fact]
    public void SuggestWithinLocationSequence_OrdersByDisciplineSequence()
    {
        var activities = new List<Activity>
        {
            new() { ActivityId = "A1", LocationCode = "L1", ActivityGroup = "Architectural" },
            new() { ActivityId = "A2", LocationCode = "L1", ActivityGroup = "Structural" },
        };
        var rules = new List<DisciplineSequenceRule>
        {
            new() { ActivityGroup = "Structural", Sequence = 1 },
            new() { ActivityGroup = "Architectural", Sequence = 2 },
        };

        var result = new LogicSuggestionService().SuggestWithinLocationSequence(activities, rules, IdSequence());

        Assert.True(result.Validation.IsValid);
        Assert.Single(result.Relationships);
        Assert.Equal("A2", result.Relationships[0].PredecessorId); // Structural first
        Assert.Equal("A1", result.Relationships[0].SuccessorId);
        Assert.Equal(ReviewStatus.Suggested, result.Relationships[0].ReviewStatus);
    }

    [Fact]
    public void SuggestMilestoneLinks_ConnectsDanglingActivitiesToStartAndFinish()
    {
        var activities = new List<Activity>
        {
            new() { ActivityId = "START" }, new() { ActivityId = "A1" }, new() { ActivityId = "FINISH" }
        };
        var existing = new List<Relationship>();

        var relationships = new LogicSuggestionService().SuggestMilestoneLinks(activities, existing, "START", "FINISH", IdSequence());

        Assert.Contains(relationships, r => r.PredecessorId == "START" && r.SuccessorId == "A1");
        Assert.Contains(relationships, r => r.PredecessorId == "A1" && r.SuccessorId == "FINISH");
    }
}
