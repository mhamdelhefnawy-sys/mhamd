using PlanFlow.Core.Domain;
using PlanFlow.Core.Manpower;
using PlanFlow.Core.Xer;
using Xunit;

namespace PlanFlow.Core.Tests;

public class ManpowerAndXerTests
{
    [Fact]
    public void DurationCalculator_MethodR_ComputesFromProductivity()
    {
        var activity = new Activity { ActivityId = "A1", Quantity = 100, DurationMethod = DurationMethod.Productivity };
        var productivity = new ProductivityEntry { ProductivityRate = 25, NumberOfCrews = 2 };

        DurationCalculator.Apply(activity, productivity);

        Assert.Equal(2, activity.Duration); // 100 / 25 / 2 = 2
        Assert.Equal(activity.Duration, activity.RemainingDuration);
    }

    [Fact]
    public void DurationCalculator_MethodD_KeepsUserEnteredDuration()
    {
        var activity = new Activity { ActivityId = "A1", Duration = 7, DurationMethod = DurationMethod.Direct };

        DurationCalculator.Apply(activity, productivity: null);

        Assert.Equal(7, activity.Duration);
    }

    [Fact]
    public void ResourceFactory_CreatesSevenStandardTrades()
    {
        var resources = ResourceFactory.CreateStandardManpowerResources();
        Assert.Equal(7, resources.Count);
        Assert.Contains(resources, r => r.ResourceName == "Steel Fixer");
    }

    private static XerExportModel ValidModel() => new()
    {
        Project = new Project { ProjectId = "P1", ProjectName = "Demo", Currency = "SAR", DataDate = DateTime.Today, StartDate = DateTime.Today, ContractFinishDate = DateTime.Today.AddMonths(6) },
        WbsNodes = new List<WbsNode> { new() { WBSCode = "W1", WBSName = "Root" } },
        Activities = new List<Activity> { new() { ActivityId = "A1", ActivityName = "Footing", WBSCode = "W1" } },
        Relationships = new List<Relationship>(),
        Resources = new List<Resource>()
    };

    [Fact]
    public void XerExportValidator_RejectsDuplicateActivityIds()
    {
        var model = ValidModel();
        model.Activities = new List<Activity>
        {
            new() { ActivityId = "A1", WBSCode = "W1" },
            new() { ActivityId = "A1", WBSCode = "W1" },
        };

        var result = XerExportValidator.Validate(model);
        Assert.Contains(result.Errors, e => e.Code == "ACTIVITY_ID_DUPLICATE");
    }

    [Fact]
    public void XerExportValidator_RejectsSelfLink()
    {
        var model = ValidModel();
        model.Relationships = new List<Relationship> { new() { RelationshipId = "R1", PredecessorId = "A1", SuccessorId = "A1" } };

        var result = XerExportValidator.Validate(model);
        Assert.Contains(result.Errors, e => e.Code == "XER_REL_SELF_LINK");
    }

    [Fact]
    public void XerExportValidator_RejectsCircularLogic()
    {
        var model = ValidModel();
        model.Activities = new List<Activity>
        {
            new() { ActivityId = "A1", WBSCode = "W1" },
            new() { ActivityId = "A2", WBSCode = "W1" },
        };
        model.Relationships = new List<Relationship>
        {
            new() { RelationshipId = "R1", PredecessorId = "A1", SuccessorId = "A2" },
            new() { RelationshipId = "R2", PredecessorId = "A2", SuccessorId = "A1" },
        };

        var result = XerExportValidator.Validate(model);
        Assert.Contains(result.Errors, e => e.Code == "XER_REL_CIRCULAR");
    }

    [Fact]
    public void XerExportValidator_ValidModel_HasNoErrors()
    {
        var result = XerExportValidator.Validate(ValidModel());
        Assert.True(result.IsValid);
    }

    [Fact]
    public void XerWriter_ProducesTablesForCoreEntities()
    {
        var xer = new XerWriter().Write(ValidModel());

        Assert.Contains("%T\tPROJECT", xer);
        Assert.Contains("%T\tPROJWBS", xer);
        Assert.Contains("%T\tTASK", xer);
        Assert.Contains("%T\tTASKPRED", xer);
        Assert.Contains("%T\tCALENDAR", xer);
        Assert.Contains("%T\tRSRC", xer);
        Assert.Contains("A1", xer);
    }
}
