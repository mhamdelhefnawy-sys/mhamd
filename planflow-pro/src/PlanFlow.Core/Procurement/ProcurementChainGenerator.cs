using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Procurement;

/// <summary>One row of Procurement_Families.</summary>
public sealed class ProcurementFamily
{
    public string FamilyCode { get; set; } = string.Empty;
    public string FamilyName { get; set; } = string.Empty;
    public decimal SubmittalDuration { get; set; }
    public decimal ApprovalDuration { get; set; }
    public decimal POLeadTime { get; set; }
    public decimal FabricationDuration { get; set; }
    public decimal DeliveryDuration { get; set; }
    public string? Discipline { get; set; }
}

/// <summary>One row of Procurement_Names: a material assigned to a family for one activity.</summary>
public sealed class ProcurementMaterial
{
    public string MaterialName { get; set; } = string.Empty;
    public string FamilyCode { get; set; } = string.Empty;
    /// <summary>The construction activity that consumes this material.</summary>
    public string ConsumingActivityId { get; set; } = string.Empty;
    public bool Excluded { get; set; }
}

public sealed class ProcurementChainResult
{
    public IReadOnlyList<Activity> Activities { get; init; } = Array.Empty<Activity>();
    public IReadOnlyList<Relationship> Relationships { get; init; } = Array.Empty<Relationship>();
}

/// <summary>
/// Generates "Material Submittal -> Material Approval -> PO -> Fabrication & Delivery"
/// ahead of the activity that needs the material, per the family's durations.
/// Materials flagged Excluded are skipped entirely.
/// </summary>
public sealed class ProcurementChainGenerator
{
    public ProcurementChainResult Generate(
        IReadOnlyList<ProcurementMaterial> materials,
        IReadOnlyList<ProcurementFamily> families,
        Func<string> activityIdGenerator,
        Func<string> relationshipIdGenerator)
    {
        var familyByCode = families.ToDictionary(f => f.FamilyCode, StringComparer.OrdinalIgnoreCase);
        var activities = new List<Activity>();
        var relationships = new List<Relationship>();

        foreach (var material in materials)
        {
            if (material.Excluded) continue;
            if (!familyByCode.TryGetValue(material.FamilyCode, out var family)) continue;

            var submittal = NewActivity(activityIdGenerator(), $"Material Submittal - {material.MaterialName}", family.SubmittalDuration, family.Discipline);
            var approval = NewActivity(activityIdGenerator(), $"Material Approval - {material.MaterialName}", family.ApprovalDuration, family.Discipline);
            var po = NewActivity(activityIdGenerator(), $"PO - {material.MaterialName}", family.POLeadTime, family.Discipline);
            var fabDelivery = NewActivity(activityIdGenerator(), $"Fabrication & Delivery - {material.MaterialName}",
                family.FabricationDuration + family.DeliveryDuration, family.Discipline);

            activities.AddRange(new[] { submittal, approval, po, fabDelivery });

            Chain(relationships, relationshipIdGenerator, submittal.ActivityId, approval.ActivityId);
            Chain(relationships, relationshipIdGenerator, approval.ActivityId, po.ActivityId);
            Chain(relationships, relationshipIdGenerator, po.ActivityId, fabDelivery.ActivityId);
            Chain(relationships, relationshipIdGenerator, fabDelivery.ActivityId, material.ConsumingActivityId);
        }

        return new ProcurementChainResult { Activities = activities, Relationships = relationships };
    }

    private static Activity NewActivity(string id, string name, decimal duration, string? discipline) => new()
    {
        ActivityId = id,
        ActivityName = name,
        ActivityType = "Procurement",
        Discipline = discipline,
        Duration = duration,
        DurationMethod = DurationMethod.Direct,
        Source = "ProcurementChain"
    };

    private static void Chain(List<Relationship> relationships, Func<string> relationshipIdGenerator, string predecessorId, string successorId) =>
        relationships.Add(new Relationship
        {
            RelationshipId = relationshipIdGenerator(),
            PredecessorId = predecessorId,
            SuccessorId = successorId,
            RelationshipType = RelationshipType.FS,
            Source = "ProcurementChain"
        });
}
