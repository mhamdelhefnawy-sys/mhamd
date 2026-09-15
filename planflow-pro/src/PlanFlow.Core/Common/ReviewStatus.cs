namespace PlanFlow.Core.Common;

/// <summary>
/// Lifecycle state for anything the AI/mapping/generation layer proposes.
/// Enforced end to end so nothing suggested is ever treated as final without a human step.
/// </summary>
public enum ReviewStatus
{
    Suggested,
    Reviewed,
    Approved,
    Rejected,
    Manual
}
