using PlanFlow.Core.Common;

namespace PlanFlow.Core.Domain;

public enum RelationshipType
{
    FS,
    SS,
    FF,
    SF
}

public sealed class Relationship
{
    public string RelationshipId { get; set; } = string.Empty;
    public string PredecessorId { get; set; } = string.Empty;
    public string SuccessorId { get; set; } = string.Empty;
    public RelationshipType RelationshipType { get; set; } = RelationshipType.FS;
    public decimal Lag { get; set; }
    public string Source { get; set; } = "Manual";
    public ReviewStatus ReviewStatus { get; set; } = ReviewStatus.Manual;
    public string ValidationStatus { get; set; } = "Unvalidated";
}
