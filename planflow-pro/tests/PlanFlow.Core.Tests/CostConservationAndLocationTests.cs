using PlanFlow.Core.Common;
using PlanFlow.Core.Domain;
using PlanFlow.Core.Locations;
using Xunit;

namespace PlanFlow.Core.Tests;

public class CostConservationAndLocationTests
{
    [Fact]
    public void CostConservation_MatchingTotals_IsValid()
    {
        var result = CostConservation.ValidateCost(1000m, new[] { 300m, 400m, 300m });
        Assert.True(result.IsValid);
    }

    [Fact]
    public void CostConservation_MismatchedTotals_IsInvalid()
    {
        var result = CostConservation.ValidateCost(1000m, new[] { 300m, 400m, 250m });
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Code == "COST_NOT_CONSERVED");
    }

    [Fact]
    public void LocationBuilder_RegisteredCombination_IsValid()
    {
        var builder = new LocationBuilder();
        builder.Add(new LocationCombination { Building = "Building A", Floor = "Floor 01", Trade = "Structural" });

        Assert.True(builder.IsValidCombination("Building A-Floor 01-Structural"));
        Assert.False(builder.IsValidCombination("Building B-Roof-Waterproofing"));
    }

    [Fact]
    public void LocationBuilder_EmptyCombination_IsRejected()
    {
        var builder = new LocationBuilder();
        var result = builder.Add(new LocationCombination());

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Code == "LOCATION_EMPTY");
    }
}
