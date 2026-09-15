using PlanFlow.Core.Common;
using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Boq;

/// <summary>
/// Validates a batch of BOQ rows per the spec's Load BOQ rules:
/// positive quantity, non-negative cost, unit present, description non-empty,
/// and no duplicate BOQCode.
/// </summary>
public static class BoqValidator
{
    public static ValidationResult Validate(IReadOnlyList<BoqItem> items)
    {
        var result = new ValidationResult();
        var seenCodes = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.BOQCode))
            {
                result.Add(ValidationIssue.Error("BOQ_CODE_EMPTY", "BOQCode is required.", item.OriginalRow, nameof(item.BOQCode)));
            }
            else if (seenCodes.TryGetValue(item.BOQCode, out var firstRow))
            {
                result.Add(ValidationIssue.Error("BOQ_CODE_DUPLICATE",
                    $"BOQCode '{item.BOQCode}' duplicates the one on row {firstRow}.", item.OriginalRow, nameof(item.BOQCode)));
            }
            else
            {
                seenCodes[item.BOQCode] = item.OriginalRow;
            }

            if (string.IsNullOrWhiteSpace(item.Description))
            {
                result.Add(ValidationIssue.Error("BOQ_DESCRIPTION_EMPTY", "Description must not be empty.", item.OriginalRow, nameof(item.Description)));
            }

            if (string.IsNullOrWhiteSpace(item.Unit))
            {
                result.Add(ValidationIssue.Error("BOQ_UNIT_MISSING", "Unit is required.", item.OriginalRow, nameof(item.Unit)));
            }

            if (item.Quantity <= 0)
            {
                result.Add(ValidationIssue.Error("BOQ_QUANTITY_NOT_POSITIVE", "Quantity must be a positive number.", item.OriginalRow, nameof(item.Quantity)));
            }

            if (item.TotalCost < 0)
            {
                result.Add(ValidationIssue.Error("BOQ_COST_NEGATIVE", "Total cost must not be negative.", item.OriginalRow, nameof(item.TotalCost)));
            }
        }

        return result;
    }
}
