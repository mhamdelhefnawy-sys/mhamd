using PlanFlow.Core.CostStages;
using PlanFlow.Core.Domain;
using Xunit;

namespace PlanFlow.Core.Tests;

public class CostStageTests
{
    [Fact]
    public void ValidatePercentages_Sums100_IsValid()
    {
        var stages = new List<CostStage>
        {
            new() { StageName = "Engineering", Percentage = 10 },
            new() { StageName = "Procurement", Percentage = 20 },
            new() { StageName = "Construction", Percentage = 60 },
            new() { StageName = "Closeout", Percentage = 10 },
        };

        Assert.True(new CostStageService().ValidatePercentages(stages).IsValid);
    }

    [Fact]
    public void ValidatePercentages_NotSumming100_IsInvalid()
    {
        var stages = new List<CostStage> { new() { StageName = "A", Percentage = 50 } };
        var result = new CostStageService().ValidatePercentages(stages);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Code == "COST_STAGE_NOT_100");
    }

    [Fact]
    public void Apply_DoesNotChangeTotalProjectCost()
    {
        var activities = new List<Activity>
        {
            new() { ActivityId = "A1", Cost = 1000m },
            new() { ActivityId = "A2", Cost = 333.33m },
        };
        var stages = new List<CostStage>
        {
            new() { StageName = "Engineering", Percentage = 10 },
            new() { StageName = "Construction", Percentage = 90 },
        };

        var allocations = new CostStageService().Apply(activities, stages);

        var totalBefore = activities.Sum(a => a.Cost);
        var totalAfter = allocations.Sum(a => a.Cost);
        Assert.Equal(totalBefore, totalAfter);
    }

    [Fact]
    public void Apply_WithBadPercentages_Throws()
    {
        var activities = new List<Activity> { new() { ActivityId = "A1", Cost = 100m } };
        var stages = new List<CostStage> { new() { StageName = "A", Percentage = 50 } };

        Assert.Throws<InvalidOperationException>(() => new CostStageService().Apply(activities, stages));
    }
}
