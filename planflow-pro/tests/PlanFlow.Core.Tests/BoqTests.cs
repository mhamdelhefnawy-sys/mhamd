using PlanFlow.Core.Boq;
using PlanFlow.Core.Domain;
using Xunit;

namespace PlanFlow.Core.Tests;

public class BoqTests
{
    private static IReadOnlyDictionary<string, string?> Row(string code, string desc, string unit, string qty, string rate) =>
        new Dictionary<string, string?>
        {
            ["Code"] = code, ["Description"] = desc, ["Unit"] = unit, ["Quantity"] = qty, ["Rate"] = rate
        };

    [Fact]
    public void Import_ValidBoq_ProducesNoErrors()
    {
        var rows = new[] { Row("B-001", "RC Footing", "m3", "10", "500") };
        var outcome = new BoqImporter().Import(rows, BoqColumnMapping.Default());

        Assert.True(outcome.Validation.IsValid);
        Assert.Single(outcome.Items);
        Assert.Equal(5000m, outcome.Items[0].TotalCost);
    }

    [Fact]
    public void Import_IncompleteBoq_IsRejected()
    {
        var rows = new[] { Row("B-002", "", "", "-5", "500") };
        var outcome = new BoqImporter().Import(rows, BoqColumnMapping.Default());

        Assert.False(outcome.Validation.IsValid);
        Assert.Contains(outcome.Validation.Errors, e => e.Code == "BOQ_DESCRIPTION_EMPTY");
        Assert.Contains(outcome.Validation.Errors, e => e.Code == "BOQ_UNIT_MISSING");
        Assert.Contains(outcome.Validation.Errors, e => e.Code == "BOQ_QUANTITY_NOT_POSITIVE");
    }

    [Fact]
    public void Validate_DuplicateBoqCode_IsRejected()
    {
        var items = new List<BoqItem>
        {
            new() { BOQCode = "B-001", Description = "A", Unit = "m3", Quantity = 1, OriginalRow = 2 },
            new() { BOQCode = "B-001", Description = "B", Unit = "m3", Quantity = 1, OriginalRow = 3 },
        };

        var result = BoqValidator.Validate(items);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Code == "BOQ_CODE_DUPLICATE");
    }
}
