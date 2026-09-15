using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Xer;

/// <summary>Everything the XER writer needs, gathered from the workbook by the caller.</summary>
public sealed class XerExportModel
{
    public Project Project { get; set; } = new();
    public IReadOnlyList<WbsNode> WbsNodes { get; set; } = Array.Empty<WbsNode>();
    public IReadOnlyList<Activity> Activities { get; set; } = Array.Empty<Activity>();
    public IReadOnlyList<Relationship> Relationships { get; set; } = Array.Empty<Relationship>();
    public IReadOnlyList<Resource> Resources { get; set; } = Array.Empty<Resource>();
}
