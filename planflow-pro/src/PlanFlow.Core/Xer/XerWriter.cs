using System.Text;
using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Xer;

/// <summary>
/// Writes a minimal but structurally valid Primavera P6 XER file (tab-delimited,
/// %T/%F/%R records) covering PROJECT, PROJWBS, TASK, TASKPRED, CALENDAR, RSRC
/// and TASKRSRC — the MVP export scope. Written from scratch; no XER lines or
/// resources are copied from any third-party tool.
/// </summary>
public sealed class XerWriter
{
    private const string DateFormat = "yyyy-MM-dd HH:mm";

    public string Write(XerExportModel model)
    {
        var sb = new StringBuilder();
        sb.Append("ERMHDR\t").Append(DateTime.UtcNow.ToString(DateFormat))
          .Append("\tPlanFlowPro\tAdmin\tPlanFlowPro\tProject Management\t1\t").Append(model.Project.Currency).Append('\n');

        WriteCalendarTable(sb, model);
        WriteProjectTable(sb, model.Project);
        WriteWbsTable(sb, model);
        WriteTaskTable(sb, model);
        WriteTaskPredTable(sb, model);
        WriteRsrcTable(sb, model);
        WriteTaskRsrcTable(sb, model);

        return sb.ToString();
    }

    private static void WriteTable(StringBuilder sb, string tableName, string[] fields, IEnumerable<string[]> rows)
    {
        sb.Append("%T\t").Append(tableName).Append('\n');
        sb.Append("%F\t").Append(string.Join("\t", fields)).Append('\n');
        foreach (var row in rows)
            sb.Append("%R\t").Append(string.Join("\t", row)).Append('\n');
    }

    private static void WriteCalendarTable(StringBuilder sb, XerExportModel model)
    {
        var calendarId = string.IsNullOrWhiteSpace(model.Project.DefaultCalendarId) ? "CAL1" : model.Project.DefaultCalendarId;
        WriteTable(sb, "CALENDAR", new[] { "clndr_id", "clndr_name", "default_flag" },
            new[] { new[] { calendarId, "Standard 6-Day", "Y" } });
    }

    private static void WriteProjectTable(StringBuilder sb, Project project)
    {
        WriteTable(sb, "PROJECT",
            new[] { "proj_id", "proj_short_name", "plan_start_date", "plan_end_date", "last_recalc_date" },
            new[]
            {
                new[]
                {
                    Safe(project.ProjectId),
                    Safe(project.ProjectName),
                    project.StartDate.ToString(DateFormat),
                    project.ContractFinishDate.ToString(DateFormat),
                    project.DataDate.ToString(DateFormat)
                }
            });
    }

    private static void WriteWbsTable(StringBuilder sb, XerExportModel model)
    {
        WriteTable(sb, "PROJWBS",
            new[] { "wbs_id", "proj_id", "wbs_short_name", "wbs_name", "parent_wbs_id" },
            model.WbsNodes.Select(w => new[]
            {
                Safe(w.WBSCode), Safe(model.Project.ProjectId), Safe(w.WBSCode), Safe(w.WBSName), Safe(w.ParentCode ?? "")
            }));
    }

    private static void WriteTaskTable(StringBuilder sb, XerExportModel model)
    {
        WriteTable(sb, "TASK",
            new[] { "task_id", "proj_id", "wbs_id", "task_code", "task_name", "target_drtn_hr_cnt", "phys_complete_pct", "clndr_id" },
            model.Activities.Select(a => new[]
            {
                Safe(a.ActivityId), Safe(model.Project.ProjectId), Safe(a.WBSCode ?? ""), Safe(a.ActivityId), Safe(a.ActivityName),
                (a.Duration * 8m).ToString("0.##"), a.PercentComplete.ToString("0.##"),
                Safe(a.CalendarId ?? model.Project.DefaultCalendarId)
            }));
    }

    private static void WriteTaskPredTable(StringBuilder sb, XerExportModel model)
    {
        WriteTable(sb, "TASKPRED",
            new[] { "task_pred_id", "task_id", "pred_task_id", "pred_type", "lag_hr_cnt" },
            model.Relationships.Select(r => new[]
            {
                Safe(r.RelationshipId), Safe(r.SuccessorId), Safe(r.PredecessorId), MapRelType(r.RelationshipType), (r.Lag * 8m).ToString("0.##")
            }));
    }

    private static void WriteRsrcTable(StringBuilder sb, XerExportModel model)
    {
        WriteTable(sb, "RSRC",
            new[] { "rsrc_id", "rsrc_name", "rsrc_type", "unit_of_measure" },
            model.Resources.Select(r => new[] { Safe(r.ResourceCode), Safe(r.ResourceName), MapResourceType(r.ResourceType), Safe(r.Unit ?? "") }));
    }

    private static void WriteTaskRsrcTable(StringBuilder sb, XerExportModel model)
    {
        // MVP: no per-activity resource assignment rows yet (Phase 2 "Fix Resource Assignments").
        WriteTable(sb, "TASKRSRC", new[] { "taskrsrc_id", "task_id", "rsrc_id", "target_qty", "target_cost" }, Array.Empty<string[]>());
    }

    private static string MapRelType(RelationshipType type) => type switch
    {
        RelationshipType.FS => "PR_FS",
        RelationshipType.SS => "PR_SS",
        RelationshipType.FF => "PR_FF",
        RelationshipType.SF => "PR_SF",
        _ => "PR_FS"
    };

    private static string MapResourceType(ResourceType type) => type switch
    {
        ResourceType.Labor => "RT_Labor",
        ResourceType.Material => "RT_Mat",
        ResourceType.Cash => "RT_Expense",
        _ => "RT_Labor"
    };

    private static string Safe(string value) => value.Replace('\t', ' ').Replace('\n', ' ');
}
