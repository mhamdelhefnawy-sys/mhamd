using PlanFlow.Core.Domain;
using PlanFlow.Core.Engineering;
using PlanFlow.Core.Procurement;
using Xunit;

namespace PlanFlow.Core.Tests;

public class EngineeringAndProcurementTests
{
    private static Func<string> IdSequence(string prefix)
    {
        var i = 0;
        return () => $"{prefix}{++i}";
    }

    [Fact]
    public void EngineeringChain_GeneratesSubmittalApprovalBeforeConstruction()
    {
        var construction = new List<Activity> { new() { ActivityId = "C1", ActivityName = "RC Footing", Discipline = "Structural" } };
        var defs = new List<EngineeringDefinition> { new() { Discipline = "Structural", SubmissionDuration = 3, ApprovalDuration = 2 } };

        var result = new EngineeringChainGenerator().Generate(construction, defs, IdSequence("E"), IdSequence("R"));

        Assert.Equal(2, result.Activities.Count);
        Assert.Equal(2, result.Relationships.Count);
        // submittal -> approval -> construction
        var submittal = result.Activities.First(a => a.ActivityName.StartsWith("Engineering Submittal"));
        var approval = result.Activities.First(a => a.ActivityName.StartsWith("Engineering Approval"));
        Assert.Contains(result.Relationships, r => r.PredecessorId == submittal.ActivityId && r.SuccessorId == approval.ActivityId);
        Assert.Contains(result.Relationships, r => r.PredecessorId == approval.ActivityId && r.SuccessorId == "C1");
    }

    [Fact]
    public void EngineeringChain_SkipsDisciplineWithNoDefinition()
    {
        var construction = new List<Activity> { new() { ActivityId = "C1", Discipline = "Electrical" } };
        var result = new EngineeringChainGenerator().Generate(construction, new List<EngineeringDefinition>(), IdSequence("E"), IdSequence("R"));

        Assert.Empty(result.Activities);
    }

    [Fact]
    public void ProcurementChain_GeneratesFourStepsBeforeConsumingActivity()
    {
        var families = new List<ProcurementFamily>
        {
            new() { FamilyCode = "F1", FamilyName = "Rebar", SubmittalDuration = 2, ApprovalDuration = 1, POLeadTime = 5, FabricationDuration = 10, DeliveryDuration = 3 }
        };
        var materials = new List<ProcurementMaterial> { new() { MaterialName = "Rebar 16mm", FamilyCode = "F1", ConsumingActivityId = "C1" } };

        var result = new ProcurementChainGenerator().Generate(materials, families, IdSequence("P"), IdSequence("R"));

        Assert.Equal(4, result.Activities.Count);
        Assert.Equal(4, result.Relationships.Count); // submittal->approval->po->fabdelivery->consuming
        Assert.Contains(result.Relationships, r => r.SuccessorId == "C1");
    }

    [Fact]
    public void ProcurementChain_ExcludedMaterial_IsSkipped()
    {
        var families = new List<ProcurementFamily> { new() { FamilyCode = "F1", FamilyName = "Rebar" } };
        var materials = new List<ProcurementMaterial> { new() { MaterialName = "X", FamilyCode = "F1", ConsumingActivityId = "C1", Excluded = true } };

        var result = new ProcurementChainGenerator().Generate(materials, families, IdSequence("P"), IdSequence("R"));

        Assert.Empty(result.Activities);
        Assert.Empty(result.Relationships);
    }
}
