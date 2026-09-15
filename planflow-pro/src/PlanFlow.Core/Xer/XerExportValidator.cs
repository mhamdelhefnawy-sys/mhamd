using PlanFlow.Core.Activities;
using PlanFlow.Core.Common;

namespace PlanFlow.Core.Xer;

/// <summary>
/// Mandatory pre-export checks. Export must be blocked while any Error remains,
/// unless the user explicitly chooses "Ignore" (the caller is responsible for
/// recording that choice in the Audit_Log).
/// </summary>
public static class XerExportValidator
{
    public static ValidationResult Validate(XerExportModel model)
    {
        var result = new ValidationResult();

        result.AddRange(ActivityIdGenerator.ValidateUnique(model.Activities.Select(a => a.ActivityId).ToList()).Issues);

        var wbsCodes = new HashSet<string>(model.WbsNodes.Select(w => w.WBSCode), StringComparer.OrdinalIgnoreCase);
        foreach (var activity in model.Activities)
        {
            if (string.IsNullOrWhiteSpace(activity.WBSCode))
            {
                result.Add(ValidationIssue.Error("XER_ACTIVITY_NO_WBS", $"Activity '{activity.ActivityId}' has no WBSCode."));
            }
            else if (!wbsCodes.Contains(activity.WBSCode))
            {
                result.Add(ValidationIssue.Error("XER_WBS_NOT_FOUND", $"Activity '{activity.ActivityId}' references unknown WBS '{activity.WBSCode}'."));
            }
        }

        result.AddRange(RelationshipValidation.Validate(model.Activities.Select(a => a.ActivityId), model.Relationships).Issues);

        return result;
    }
}
