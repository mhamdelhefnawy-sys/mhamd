namespace PlanFlow.Core.Common;

public enum IssueSeverity
{
    Error,
    Warning
}

/// <summary>One row-level or file-level problem found by a validator.</summary>
public sealed class ValidationIssue
{
    public IssueSeverity Severity { get; }
    public string Code { get; }
    public string Message { get; }
    public int? RowNumber { get; }
    public string? FieldName { get; }

    public ValidationIssue(IssueSeverity severity, string code, string message, int? rowNumber = null, string? fieldName = null)
    {
        Severity = severity;
        Code = code;
        Message = message;
        RowNumber = rowNumber;
        FieldName = fieldName;
    }

    public static ValidationIssue Error(string code, string message, int? rowNumber = null, string? fieldName = null) =>
        new(IssueSeverity.Error, code, message, rowNumber, fieldName);

    public static ValidationIssue Warning(string code, string message, int? rowNumber = null, string? fieldName = null) =>
        new(IssueSeverity.Warning, code, message, rowNumber, fieldName);

    public override string ToString() => RowNumber.HasValue
        ? $"[{Severity}] {Code} (row {RowNumber}{(FieldName is null ? "" : $", {FieldName}")}): {Message}"
        : $"[{Severity}] {Code}: {Message}";
}

/// <summary>Result of any validation pass: a list of issues plus a convenience IsValid flag (no errors).</summary>
public sealed class ValidationResult
{
    private readonly List<ValidationIssue> _issues = new();

    public IReadOnlyList<ValidationIssue> Issues => _issues;
    public IEnumerable<ValidationIssue> Errors => _issues.Where(i => i.Severity == IssueSeverity.Error);
    public IEnumerable<ValidationIssue> Warnings => _issues.Where(i => i.Severity == IssueSeverity.Warning);
    public bool IsValid => !Errors.Any();

    public void Add(ValidationIssue issue) => _issues.Add(issue);
    public void AddRange(IEnumerable<ValidationIssue> issues) => _issues.AddRange(issues);
}
