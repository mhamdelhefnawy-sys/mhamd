using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Audit;

/// <summary>
/// In-memory audit trail (persisted by the Excel add-in layer into the Audit_Log sheet).
/// Every mutating operation must call <see cref="Record"/> before returning, per the spec's
/// "من نفذ العملية ومتى وما عدد الصفوف المتأثرة" rule.
/// </summary>
public sealed class AuditLog
{
    private readonly List<AuditLogEntry> _entries = new();
    public IReadOnlyList<AuditLogEntry> Entries => _entries;

    public AuditLogEntry Record(string user, string operation, int affectedRows, string? details = null)
    {
        var entry = new AuditLogEntry
        {
            TimestampUtc = DateTime.UtcNow,
            User = user,
            Operation = operation,
            AffectedRows = affectedRows,
            Details = details
        };
        _entries.Add(entry);
        return entry;
    }
}
