using PlanFlow.Core.Activities;
using PlanFlow.Core.Domain;
using PlanFlow.Core.Mapping;
using Xunit;

namespace PlanFlow.Core.Tests;

public class MappingAndSplitTests
{
    [Fact]
    public void MapOneToOne_MatchedBoq_ProducesOneMappingRow()
    {
        var boq = new List<BoqItem> { new() { BOQCode = "B-1", Description = "Footing", Unit = "m3", Quantity = 10, TotalCost = 5000 } };
        var activities = new List<Activity> { new() { ActivityId = "A0010", ActivityName = "RC Footing", BOQCode = "B-1" } };

        var outcome = new MappingEngine().MapOneToOne(boq, activities);

        Assert.Single(outcome.Mapped);
        Assert.Empty(outcome.Exceptions);
        Assert.Equal("A0010", outcome.Mapped[0].ActivityId);
    }

    [Fact]
    public void MapOneToOne_UnmatchedBoq_GoesToExceptions_NotSilentActivity()
    {
        var boq = new List<BoqItem> { new() { BOQCode = "B-2", Description = "Unmapped item", Unit = "m3", Quantity = 5, TotalCost = 100 } };
        var outcome = new MappingEngine().MapOneToOne(boq, new List<Activity>());

        Assert.Empty(outcome.Mapped);
        Assert.Single(outcome.Exceptions);
    }

    [Fact]
    public void Split_QuantityAndCost_AreConservedAcrossParts()
    {
        var source = new BoqItem { BOQCode = "B-3", Description = "Structural Slab", Unit = "m3", Quantity = 33.33m, TotalCost = 9999.99m };
        var splits = new List<SplitDefinition>
        {
            new() { Name = "Formwork", RatioPercent = 30, Sequence = 1 },
            new() { Name = "Reinforcement", RatioPercent = 40, Sequence = 2 },
            new() { Name = "Concrete Pouring", RatioPercent = 30, Sequence = 3 },
        };

        var idGen = new ActivityIdGenerator();
        var result = new ActivitySplitService().Split(source, splits, idGen.Next);

        Assert.Equal(3, result.Count);
        Assert.Equal(source.Quantity, result.Sum(a => a.Quantity));
        Assert.Equal(source.TotalCost, result.Sum(a => a.Cost));
    }

    [Fact]
    public void Split_RatiosNotSummingTo100_Throws()
    {
        var source = new BoqItem { BOQCode = "B-4", Description = "X", Unit = "m3", Quantity = 10, TotalCost = 1000 };
        var badSplits = new List<SplitDefinition>
        {
            new() { Name = "A", RatioPercent = 50, Sequence = 1 },
            new() { Name = "B", RatioPercent = 40, Sequence = 2 },
        };

        Assert.Throws<InvalidOperationException>(() => new ActivitySplitService().Split(source, badSplits, () => "X"));
    }

    [Fact]
    public void ActivityIdGenerator_NeverProducesDuplicates()
    {
        var gen = new ActivityIdGenerator();
        var ids = Enumerable.Range(0, 50).Select(_ => gen.Next()).ToList();

        Assert.Equal(ids.Count, ids.Distinct().Count());
        Assert.True(ActivityIdGenerator.ValidateUnique(ids).IsValid);
    }

    [Fact]
    public void ActivityIdGenerator_ValidateUnique_DetectsExternalDuplicates()
    {
        var result = ActivityIdGenerator.ValidateUnique(new[] { "A1", "A2", "A1" });
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Code == "ACTIVITY_ID_DUPLICATE");
    }
}
