using PlanFlow.Core.Calendars;
using PlanFlow.Core.Common;
using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Scheduling;

/// <summary>
/// Computes Early Start/Early Finish (calendar-adjusted), Total Float, and the
/// Critical flag for a network of activities and FS/SS/FF/SF relationships with lag.
/// Requires the relationship network to already be free of cycles/self-links/dangling
/// references (see <see cref="Common.RelationshipValidation"/>) — call that first.
/// </summary>
public sealed class ForwardPassEngine
{
    public ValidationResult Run(
        IReadOnlyList<Activity> activities,
        IReadOnlyList<Relationship> relationships,
        IReadOnlyDictionary<string, ProjectCalendar> calendarsById,
        ProjectCalendar defaultCalendar,
        DateTime projectStart)
    {
        var validation = RelationshipValidation.Validate(activities.Select(a => a.ActivityId), relationships);
        if (!validation.IsValid) return validation;

        var byId = activities.ToDictionary(a => a.ActivityId, StringComparer.OrdinalIgnoreCase);
        var predecessorsOf = relationships
            .GroupBy(r => r.SuccessorId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);
        var successorsOf = relationships
            .GroupBy(r => r.PredecessorId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);

        var order = TopologicalOrder(activities.Select(a => a.ActivityId), relationships);

        foreach (var id in order)
        {
            var activity = byId[id];
            var calendar = activity.CalendarId is not null && calendarsById.TryGetValue(activity.CalendarId, out var c) ? c : defaultCalendar;

            DateTime earlyStart = projectStart;
            if (predecessorsOf.TryGetValue(id, out var preds) && preds.Count > 0)
            {
                earlyStart = preds.Max(rel =>
                {
                    var pred = byId[rel.PredecessorId];
                    // FF/SF are approximated by back-solving the successor's start from its own
                    // duration; a full CPM implementation would iterate until stable. Adequate
                    // for the MVP's FS-dominant networks (Engineering/Procurement chains, location
                    // sequencing) — revisit if FF/SF usage grows in later phases.
                    var basis = rel.RelationshipType switch
                    {
                        RelationshipType.FS => pred.EarlyFinish ?? projectStart,
                        RelationshipType.SS => pred.EarlyStart ?? projectStart,
                        RelationshipType.FF => (pred.EarlyFinish ?? projectStart).AddDays(-(double)activity.Duration),
                        RelationshipType.SF => (pred.EarlyStart ?? projectStart).AddDays(-(double)activity.Duration),
                        _ => pred.EarlyFinish ?? projectStart
                    };
                    return calendar.AddWorkingDays(basis, (int)rel.Lag);
                });
                earlyStart = calendar.AddWorkingDays(earlyStart, 0);
            }
            else
            {
                earlyStart = calendar.AddWorkingDays(projectStart, 0);
            }

            var earlyFinish = activity.Duration <= 0
                ? earlyStart
                : calendar.AddWorkingDays(earlyStart, (int)activity.Duration);

            activity.EarlyStart = earlyStart;
            activity.EarlyFinish = earlyFinish;
        }

        var projectFinish = activities.Count == 0 ? projectStart : activities.Max(a => a.EarlyFinish ?? projectStart);

        foreach (var id in order.AsEnumerable().Reverse())
        {
            var activity = byId[id];
            var calendar = activity.CalendarId is not null && calendarsById.TryGetValue(activity.CalendarId, out var c) ? c : defaultCalendar;

            DateTime lateFinish = projectFinish;
            if (successorsOf.TryGetValue(id, out var succs) && succs.Count > 0)
            {
                lateFinish = succs.Min(rel => byId[rel.SuccessorId].EarlyStart ?? projectFinish);
            }

            var totalFloatDays = WorkingDayGap(calendar, activity.EarlyFinish ?? projectFinish, lateFinish);
            activity.TotalFloat = totalFloatDays;
            activity.IsCritical = totalFloatDays <= 0;
        }

        return validation;
    }

    /// <summary>Working days strictly after <paramref name="from"/> through <paramref name="to"/>
    /// inclusive — 0 when <paramref name="to"/> is not later than <paramref name="from"/>, so an
    /// activity whose late finish equals its early finish reports exactly zero float.</summary>
    private static decimal WorkingDayGap(ProjectCalendar calendar, DateTime from, DateTime to)
    {
        if (to <= from) return 0m;
        return calendar.CountWorkingDays(from.AddDays(1), to);
    }

    private static List<string> TopologicalOrder(IEnumerable<string> activityIds, IReadOnlyList<Relationship> relationships)
    {
        var ids = activityIds.ToList();
        var adjacency = relationships
            .GroupBy(r => r.PredecessorId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Select(r => r.SuccessorId).ToList(), StringComparer.OrdinalIgnoreCase);

        var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var order = new List<string>();

        void Visit(string id)
        {
            if (!visited.Add(id)) return;
            if (adjacency.TryGetValue(id, out var successors))
                foreach (var s in successors) Visit(s);
            order.Add(id);
        }

        foreach (var id in ids) Visit(id);
        order.Reverse();
        return order;
    }
}
