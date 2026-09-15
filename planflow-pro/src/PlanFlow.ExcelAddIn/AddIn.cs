using System.Runtime.InteropServices;
using ExcelDna.Integration;
using ExcelDna.Integration.CustomUI;
using Microsoft.Office.Interop.Excel;
using PlanFlow.Core.Activities;
using PlanFlow.Core.Ai;
using PlanFlow.Core.Audit;
using PlanFlow.Core.Boq;
using PlanFlow.Core.Calendars;
using PlanFlow.Core.Common;
using PlanFlow.Core.CostStages;
using PlanFlow.Core.Domain;
using PlanFlow.Core.Engineering;
using PlanFlow.Core.Logic;
using PlanFlow.Core.Manpower;
using PlanFlow.Core.Mapping;
using PlanFlow.Core.Procurement;
using PlanFlow.Core.Scheduling;
using PlanFlow.Core.Xer;

namespace PlanFlow.ExcelAddIn;

public sealed class AddIn : IExcelAddIn
{
    public void AutoOpen() { }
    public void AutoClose() { }
}

/// <summary>
/// The PlanFlow Pro ribbon and its command handlers. Wires the Excel workbook to
/// the framework-agnostic Core services; scope here is the Phase 1 MVP command set
/// (Import/BOQ, Assistant's Generate/Apply Activities, Mapping, Manpower/Resources,
/// XER export, About/Settings). Later-phase ribbon groups are declared but stubbed.
/// </summary>
[ComVisible(true)]
public sealed class PlanFlowRibbon : ExcelRibbon
{
    private readonly AuditLog _auditLog = new();
    private readonly CalendarLibrary _calendarLibrary = new();
    private int _relationshipCounter;

    private static Application ExcelApp => (Application)ExcelDnaUtil.Application;
    private static Workbook ActiveWorkbook => ExcelApp.ActiveWorkbook;

    public override string GetCustomUI(string ribbonId) => RibbonXml.Xml;

    // ---------- Import / BOQ ----------

    public void OnLoadBoq(IRibbonControl control)
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.InputBoq);
        var sourceSheet = ExcelApp.ActiveSheet as Worksheet;
        if (sourceSheet is null) return;

        var rawRows = ExcelRangeIO.ReadTableAsRows(sourceSheet);
        var importer = new BoqImporter();
        var outcome = importer.Import(rawRows, BoqColumnMapping.Default());

        WriteBoqSheet(sheet, outcome.Items);
        WriteValidationReport(outcome.Validation, "Load BOQ");
        _auditLog.Record(Environment.UserName, "Load BOQ", outcome.Items.Count,
            $"Errors: {outcome.Validation.Errors.Count()}");

        XlCall.Excel(XlCall.xlcAlert,
            $"Loaded {outcome.Items.Count} BOQ rows. {outcome.Validation.Errors.Count()} error(s) — see {SheetNames.ValidationReport}.");
    }

    public void OnValidateBoq(IRibbonControl control)
    {
        var items = ReadBoqSheet();
        var validation = BoqValidator.Validate(items);
        WriteValidationReport(validation, "Validate BOQ");
        _auditLog.Record(Environment.UserName, "Validate BOQ", items.Count, $"Errors: {validation.Errors.Count()}");
    }

    // ---------- Assistant ----------

    public void OnGenerateActivities(IRibbonControl control)
    {
        var boqItems = ReadBoqSheet();
        var service = new ActivityGenerationService(new MockAiProvider());
        var reviewRows = service.GenerateActivities(boqItems);

        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.AiReview);
        ExcelRangeIO.WriteRows(sheet,
            new[] { "BOQCode", "ActivityName", "Discipline", "Evidence", "SuggestedActivityGroup", "Confidence", "ReviewStatus" },
            reviewRows.Select(r => new[]
            {
                r.BOQCode, r.ActivityName, r.Discipline ?? "", r.Evidence ?? "",
                r.SuggestedActivityGroup ?? "", r.Confidence.ToString("0.00"), r.ReviewStatus.ToString()
            }));

        _auditLog.Record(Environment.UserName, "Generate Activities", reviewRows.Count);
    }

    public void OnApplyReviewedActivityPlan(IRibbonControl control)
    {
        BackupService.Backup(ActiveWorkbook);

        var boqItems = ReadBoqSheet();
        var boqByCode = boqItems.ToDictionary(b => b.BOQCode, StringComparer.OrdinalIgnoreCase);
        var reviewRows = ReadAiReviewSheet();

        var idGen = new ActivityIdGenerator();
        var service = new ActivityGenerationService(new MockAiProvider());
        var plan = service.ApplyReviewedPlan(reviewRows, boqByCode, idGen.Next);

        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.ConstructionActivityPlan);
        ExcelRangeIO.WriteRows(sheet,
            new[] { "ActivityId", "ActivityName", "Discipline", "BOQCode", "ActivityGroup", "Unit", "Quantity", "Cost", "Source", "ReviewStatus" },
            plan.Select(a => new[]
            {
                a.ActivityId, a.ActivityName, a.Discipline ?? "", a.BOQCode ?? "", a.ActivityGroup ?? "",
                a.Unit ?? "", a.Quantity.ToString("0.####"), a.Cost.ToString("0.##"), a.Source, a.ReviewStatus.ToString()
            }));

        _auditLog.Record(Environment.UserName, "Apply Reviewed Activity Plan", plan.Count);
        XlCall.Excel(XlCall.xlcAlert, $"{plan.Count} activities moved to {SheetNames.ConstructionActivityPlan}.");
    }

    public void OnMapBoq(IRibbonControl control)
    {
        var boqItems = ReadBoqSheet();
        var activities = ReadActivityPlanSheet();
        var engine = new MappingEngine();
        var outcome = engine.MapOneToOne(boqItems, activities);

        var mapSheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.AiMapReview);
        ExcelRangeIO.WriteRows(mapSheet,
            new[] { "BOQCode", "ActivityId", "ActivityName", "WBSCode", "LocationCode", "Quantity", "Cost", "Source", "ReviewStatus" },
            outcome.Mapped.Select(m => new[]
            {
                m.BOQCode, m.ActivityId, m.ActivityName, m.WBSCode ?? "", m.LocationCode ?? "",
                m.Quantity.ToString("0.####"), m.Cost.ToString("0.##"), m.Source, m.ReviewStatus.ToString()
            }));

        _auditLog.Record(Environment.UserName, "Map BOQ", outcome.Mapped.Count,
            $"Exceptions: {outcome.Exceptions.Count}");
    }

    // ---------- Cost and Resources ----------

    public void OnCalculateManpower(IRibbonControl control)
    {
        var activities = ReadActivityPlanSheet();
        // MVP default productivity: 10 units/crew/day, 1 crew — a real project loads this from the Manpower sheet.
        var defaultProductivity = new ProductivityEntry { ProductivityRate = 10m, NumberOfCrews = 1 };

        foreach (var activity in activities)
        {
            if (activity.DurationMethod == DurationMethod.Direct && activity.Duration > 0) continue;
            DurationCalculator.Apply(activity, defaultProductivity);
        }

        WriteActivityPlanSheet(activities);
        _auditLog.Record(Environment.UserName, "Calculate Manpower", activities.Count);
    }

    public void OnCreateManpowerResources(IRibbonControl control)
    {
        var resources = ResourceFactory.CreateStandardManpowerResources();
        WriteResourcesSheet(resources);
        _auditLog.Record(Environment.UserName, "Create Manpower Resources", resources.Count);
    }

    public void OnIdentifyCashResource(IRibbonControl control)
    {
        var currency = ActiveWorkbook.Application.InputBox("Currency code (e.g. SAR):", "PlanFlow Pro", "SAR").ToString();
        var cash = ResourceFactory.CreateCashResource(currency);
        var existing = ReadResourcesSheet();
        existing.Add(cash);
        WriteResourcesSheet(existing);
        _auditLog.Record(Environment.UserName, "Identify Cash Resource", 1);
    }

    // ---------- XER / Primavera ----------

    public void OnExportFullXer(IRibbonControl control)
    {
        var model = new XerExportModel
        {
            Project = ReadProjectSetup(),
            WbsNodes = ReadWbsSheet(),
            Activities = ReadActivityPlanSheet(),
            Relationships = Array.Empty<Relationship>(),
            Resources = ReadResourcesSheet()
        };

        var validation = XerExportValidator.Validate(model);
        WriteValidationReport(validation, "Export Full XER");

        if (!validation.IsValid)
        {
            XlCall.Excel(XlCall.xlcAlert,
                $"Export blocked: {validation.Errors.Count()} error(s). See {SheetNames.ValidationReport}.");
            _auditLog.Record(Environment.UserName, "Export Full XER (blocked)", 0);
            return;
        }

        var xer = new XerWriter().Write(model);
        var path = System.IO.Path.Combine(
            string.IsNullOrEmpty(ActiveWorkbook.Path) ? System.IO.Path.GetTempPath() : ActiveWorkbook.Path,
            $"{model.Project.ProjectId}.xer");
        System.IO.File.WriteAllText(path, xer);

        _auditLog.Record(Environment.UserName, "Export Full XER", model.Activities.Count, path);
        XlCall.Excel(XlCall.xlcAlert, $"XER exported to {path}");
    }

    // ---------- Cost Stages (Phase 2) ----------

    public void OnApplyCostStages(IRibbonControl control)
    {
        var activities = ReadActivityPlanSheet();
        var stages = ReadCostStagesSheet();
        var service = new CostStageService();

        var validation = service.ValidatePercentages(stages);
        WriteValidationReport(validation, "Apply Cost Stages");
        if (!validation.IsValid)
        {
            XlCall.Excel(XlCall.xlcAlert, $"Cost stages must sum to 100%. See {SheetNames.ValidationReport}.");
            return;
        }

        var allocations = service.Apply(activities, stages);
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.CostStages);
        ExcelRangeIO.WriteRows(sheet, new[] { "ActivityId", "StageName", "Cost" },
            allocations.Select(a => new[] { a.ActivityId, a.StageName, a.Cost.ToString("0.##") }));

        _auditLog.Record(Environment.UserName, "Apply Cost Stages", allocations.Count);
    }

    // ---------- Engineering / Procurement (Phase 2) ----------

    public void OnGenerateEngineeringActivities(IRibbonControl control)
    {
        var construction = ReadActivityPlanSheet();
        var definitions = ReadEngineeringDefinitionsSheet();
        var idGen = new ActivityIdGenerator("E", construction.Select(a => a.ActivityId));

        var result = new EngineeringChainGenerator().Generate(construction, definitions, idGen.Next, NextRelationshipId);

        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.EngineeringActivities);
        WriteActivityRows(sheet, result.Activities);
        AppendRelationshipsToLogicGenerated(result.Relationships);

        _auditLog.Record(Environment.UserName, "Generate Engineering Activities", result.Activities.Count);
    }

    public void OnGenerateProcurementList(IRibbonControl control)
    {
        var materials = ReadProcurementMaterialsSheet();
        var families = ReadProcurementFamiliesSheet();
        var idGen = new ActivityIdGenerator("P", ReadActivityPlanSheet().Select(a => a.ActivityId));

        var result = new ProcurementChainGenerator().Generate(materials, families, idGen.Next, NextRelationshipId);

        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.ProcurementActivities);
        WriteActivityRows(sheet, result.Activities);
        AppendRelationshipsToLogicGenerated(result.Relationships);

        _auditLog.Record(Environment.UserName, "Generate Procurement List", result.Activities.Count);
    }

    // ---------- Calendar (Phase 2) ----------

    public void OnIdentifyCalendar(IRibbonControl control)
    {
        var project = ReadProjectSetup();
        var calendar = _calendarLibrary.Build(new CalendarDefinition
        {
            CalendarId = string.IsNullOrWhiteSpace(project.DefaultCalendarId) ? "CAL1" : project.DefaultCalendarId,
            Country = project.Country
        });

        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.Calendars);
        ExcelRangeIO.WriteRows(sheet, new[] { "CalendarId", "Country", "DailyHours", "RamadanDailyHours" },
            new[] { new[] { calendar.CalendarId, calendar.Country, calendar.DailyHours.ToString("0.##"), calendar.RamadanDailyHours.ToString("0.##") } });

        _auditLog.Record(Environment.UserName, "Identify Calendar", 1);
    }

    // ---------- Logic / Scheduling (Phase 2) ----------

    public void OnSuggestLogic(IRibbonControl control)
    {
        var activities = ReadActivityPlanSheet();
        var service = new LogicSuggestionService();
        var result = service.SuggestWithinLocationSequence(activities, DefaultDisciplineSequence.Rules, NextRelationshipId);

        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.Logic);
        ExcelRangeIO.WriteRows(sheet, new[] { "RelationshipId", "PredecessorId", "SuccessorId", "RelationshipType", "Lag", "Source", "ReviewStatus" },
            result.Relationships.Select(r => new[]
            {
                r.RelationshipId, r.PredecessorId, r.SuccessorId, r.RelationshipType.ToString(), r.Lag.ToString("0.##"), r.Source, r.ReviewStatus.ToString()
            }));

        WriteValidationReport(result.Validation, "Suggest Logic");
        _auditLog.Record(Environment.UserName, "Suggest Logic", result.Relationships.Count);
    }

    public void OnRunForwardPass(IRibbonControl control)
    {
        var activities = ReadActivityPlanSheet();
        var relationships = ReadLogicGeneratedSheet();
        var defaultCalendar = _calendarLibrary.All.FirstOrDefault() ?? _calendarLibrary.Build(new CalendarDefinition { CalendarId = "CAL1" });
        var project = ReadProjectSetup();

        var validation = new ForwardPassEngine().Run(activities, relationships,
            _calendarLibrary.All.ToDictionary(c => c.CalendarId, StringComparer.OrdinalIgnoreCase),
            defaultCalendar, project.StartDate);

        WriteValidationReport(validation, "Run Forward Pass");
        if (!validation.IsValid)
        {
            XlCall.Excel(XlCall.xlcAlert, $"Forward pass blocked: invalid relationship network. See {SheetNames.ValidationReport}.");
            return;
        }

        WriteActivityPlanSheet(activities);
        _auditLog.Record(Environment.UserName, "Run Forward Pass", activities.Count);
    }

    public void OnProjectTimeline(IRibbonControl control)
    {
        var activities = ReadActivityPlanSheet();
        var rows = ProjectTimelineBuilder.Build(activities);

        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.ProjectTimeline);
        ExcelRangeIO.WriteRows(sheet, new[] { "ActivityId", "ActivityName", "EarlyStart", "EarlyFinish", "TotalFloat", "IsCritical" },
            rows.Select(r => new[]
            {
                r.ActivityId, r.ActivityName, r.EarlyStart?.ToString("yyyy-MM-dd") ?? "", r.EarlyFinish?.ToString("yyyy-MM-dd") ?? "",
                r.TotalFloat?.ToString("0.##") ?? "", r.IsCritical.ToString()
            }));

        _auditLog.Record(Environment.UserName, "Project Timeline", rows.Count);
    }

    // ---------- Not yet implemented (Phase 2/3 ribbon buttons) ----------

    public void OnNotImplemented(IRibbonControl control)
    {
        XlCall.Excel(XlCall.xlcAlert, $"'{control.Id}' is planned for a later phase and is not available yet.");
    }

    // ---------- About / Settings ----------

    public void OnBackupWorkbook(IRibbonControl control)
    {
        var path = BackupService.Backup(ActiveWorkbook);
        _auditLog.Record(Environment.UserName, "Backup Workbook", 1, path);
        XlCall.Excel(XlCall.xlcAlert, path is null ? "Save the workbook first." : $"Backup created: {path}");
    }

    public void OnShowAuditLog(IRibbonControl control)
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.AuditLog);
        ExcelRangeIO.WriteRows(sheet, new[] { "TimestampUtc", "User", "Operation", "AffectedRows", "Details" },
            _auditLog.Entries.Select(e => new[]
            {
                e.TimestampUtc.ToString("u"), e.User, e.Operation, e.AffectedRows.ToString(), e.Details ?? ""
            }));
    }

    // ---------- sheet <-> domain helpers ----------

    private List<BoqItem> ReadBoqSheet()
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.InputBoq);
        var rows = ExcelRangeIO.ReadTableAsRows(sheet);
        return rows.Select((r, i) => new BoqItem
        {
            OriginalRow = i + 2,
            BOQCode = r.GetValueOrDefault("BOQCode") ?? "",
            Description = r.GetValueOrDefault("Description") ?? "",
            Unit = r.GetValueOrDefault("Unit") ?? "",
            Quantity = decimal.TryParse(r.GetValueOrDefault("Quantity"), out var q) ? q : 0,
            Rate = decimal.TryParse(r.GetValueOrDefault("Rate"), out var rate) ? rate : 0,
            TotalCost = decimal.TryParse(r.GetValueOrDefault("TotalCost"), out var c) ? c : 0
        }).ToList();
    }

    private void WriteBoqSheet(Worksheet sheet, IReadOnlyList<BoqItem> items) =>
        ExcelRangeIO.WriteRows(sheet,
            new[] { "BOQCode", "Description", "Unit", "Quantity", "Rate", "TotalCost", "Status" },
            items.Select(i => new[]
            {
                i.BOQCode, i.Description, i.Unit, i.Quantity.ToString("0.####"),
                i.Rate.ToString("0.##"), i.TotalCost.ToString("0.##"), i.Status.ToString()
            }));

    private List<Activity> ReadActivityPlanSheet()
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.ConstructionActivityPlan);
        var rows = ExcelRangeIO.ReadTableAsRows(sheet);
        return rows.Select(r => new Activity
        {
            ActivityId = r.GetValueOrDefault("ActivityId") ?? "",
            ActivityName = r.GetValueOrDefault("ActivityName") ?? "",
            Discipline = r.GetValueOrDefault("Discipline"),
            WBSCode = r.GetValueOrDefault("WBSCode"),
            LocationCode = r.GetValueOrDefault("LocationCode"),
            BOQCode = r.GetValueOrDefault("BOQCode"),
            ActivityGroup = r.GetValueOrDefault("ActivityGroup"),
            Unit = r.GetValueOrDefault("Unit"),
            Quantity = decimal.TryParse(r.GetValueOrDefault("Quantity"), out var q) ? q : 0,
            Cost = decimal.TryParse(r.GetValueOrDefault("Cost"), out var c) ? c : 0,
            Duration = decimal.TryParse(r.GetValueOrDefault("Duration"), out var d) ? d : 0,
            CalendarId = r.GetValueOrDefault("CalendarId"),
            Source = r.GetValueOrDefault("Source") ?? "Manual",
            ReviewStatus = Enum.TryParse<ReviewStatus>(r.GetValueOrDefault("ReviewStatus"), out var rs) ? rs : ReviewStatus.Manual
        }).ToList();
    }

    private void WriteActivityPlanSheet(IReadOnlyList<Activity> activities)
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.ConstructionActivityPlan);
        ExcelRangeIO.WriteRows(sheet,
            new[]
            {
                "ActivityId", "ActivityName", "Discipline", "WBSCode", "LocationCode", "BOQCode", "ActivityGroup", "Unit",
                "Quantity", "Cost", "Duration", "CalendarId", "Source", "ReviewStatus", "EarlyStart", "EarlyFinish", "TotalFloat", "IsCritical"
            },
            activities.Select(a => new[]
            {
                a.ActivityId, a.ActivityName, a.Discipline ?? "", a.WBSCode ?? "", a.LocationCode ?? "", a.BOQCode ?? "", a.ActivityGroup ?? "",
                a.Unit ?? "", a.Quantity.ToString("0.####"), a.Cost.ToString("0.##"), a.Duration.ToString("0.##"), a.CalendarId ?? "",
                a.Source, a.ReviewStatus.ToString(),
                a.EarlyStart?.ToString("yyyy-MM-dd") ?? "", a.EarlyFinish?.ToString("yyyy-MM-dd") ?? "",
                a.TotalFloat?.ToString("0.##") ?? "", a.IsCritical.ToString()
            }));
    }

    private List<ActivityReviewRow> ReadAiReviewSheet()
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.AiReview);
        var rows = ExcelRangeIO.ReadTableAsRows(sheet);
        return rows.Select(r => new ActivityReviewRow
        {
            BOQCode = r.GetValueOrDefault("BOQCode") ?? "",
            ActivityName = r.GetValueOrDefault("ActivityName") ?? "",
            Discipline = r.GetValueOrDefault("Discipline"),
            Evidence = r.GetValueOrDefault("Evidence"),
            SuggestedActivityGroup = r.GetValueOrDefault("SuggestedActivityGroup"),
            Confidence = double.TryParse(r.GetValueOrDefault("Confidence"), out var conf) ? conf : 0,
            ReviewStatus = Enum.TryParse<ReviewStatus>(r.GetValueOrDefault("ReviewStatus"), out var rs) ? rs : ReviewStatus.Suggested
        }).ToList();
    }

    private List<Resource> ReadResourcesSheet()
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.Resources);
        var rows = ExcelRangeIO.ReadTableAsRows(sheet);
        return rows.Select(r => new Resource
        {
            ResourceCode = r.GetValueOrDefault("ResourceCode") ?? "",
            ResourceName = r.GetValueOrDefault("ResourceName") ?? "",
            ResourceType = Enum.TryParse<ResourceType>(r.GetValueOrDefault("ResourceType"), out var t) ? t : ResourceType.Labor,
            Unit = r.GetValueOrDefault("Unit"),
            Rate = decimal.TryParse(r.GetValueOrDefault("Rate"), out var rate) ? rate : 0
        }).ToList();
    }

    private void WriteResourcesSheet(IReadOnlyList<Resource> resources)
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.Resources);
        ExcelRangeIO.WriteRows(sheet, new[] { "ResourceCode", "ResourceName", "ResourceType", "Unit", "Rate" },
            resources.Select(r => new[] { r.ResourceCode, r.ResourceName, r.ResourceType.ToString(), r.Unit ?? "", r.Rate.ToString("0.##") }));
    }

    private List<WbsNode> ReadWbsSheet()
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.Wbs);
        var rows = ExcelRangeIO.ReadTableAsRows(sheet);
        return rows.Select(r => new WbsNode
        {
            WBSCode = r.GetValueOrDefault("WBSCode") ?? "",
            WBSName = r.GetValueOrDefault("WBSName") ?? "",
            ParentCode = r.GetValueOrDefault("ParentCode"),
            Level = int.TryParse(r.GetValueOrDefault("Level"), out var l) ? l : 0,
            Sequence = int.TryParse(r.GetValueOrDefault("Sequence"), out var s) ? s : 0
        }).ToList();
    }

    private Project ReadProjectSetup()
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.ProjectSetup);
        var rows = ExcelRangeIO.ReadTableAsRows(sheet);
        var row = rows.FirstOrDefault() ?? new Dictionary<string, string?>();
        return new Project
        {
            ProjectId = row.GetValueOrDefault("ProjectId") ?? "P1",
            ProjectName = row.GetValueOrDefault("ProjectName") ?? "New Project",
            Currency = row.GetValueOrDefault("Currency") ?? "SAR",
            StartDate = DateTime.TryParse(row.GetValueOrDefault("StartDate"), out var sd) ? sd : DateTime.Today,
            ContractFinishDate = DateTime.TryParse(row.GetValueOrDefault("ContractFinishDate"), out var fd) ? fd : DateTime.Today.AddMonths(12),
            DataDate = DateTime.TryParse(row.GetValueOrDefault("DataDate"), out var dd) ? dd : DateTime.Today,
            DefaultCalendarId = row.GetValueOrDefault("DefaultCalendarId") ?? "CAL1"
        };
    }

    private void WriteValidationReport(ValidationResult validation, string operationName)
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.ValidationReport);
        ExcelRangeIO.WriteRows(sheet, new[] { "Operation", "Severity", "Code", "Row", "Field", "Message" },
            validation.Issues.Select(i => new[]
            {
                operationName, i.Severity.ToString(), i.Code, i.RowNumber?.ToString() ?? "", i.FieldName ?? "", i.Message
            }));
    }

    private string NextRelationshipId() => $"REL{++_relationshipCounter:D4}";

    private void WriteActivityRows(Worksheet sheet, IReadOnlyList<Activity> activities) =>
        ExcelRangeIO.WriteRows(sheet,
            new[] { "ActivityId", "ActivityName", "ActivityType", "Discipline", "WBSCode", "LocationCode", "Duration", "Source" },
            activities.Select(a => new[]
            {
                a.ActivityId, a.ActivityName, a.ActivityType, a.Discipline ?? "", a.WBSCode ?? "", a.LocationCode ?? "",
                a.Duration.ToString("0.##"), a.Source
            }));

    private void AppendRelationshipsToLogicGenerated(IReadOnlyList<Relationship> newRelationships)
    {
        var existing = ReadLogicGeneratedSheet();
        var combined = existing.Concat(newRelationships).ToList();

        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.LogicGenerated);
        ExcelRangeIO.WriteRows(sheet, new[] { "RelationshipId", "PredecessorId", "SuccessorId", "RelationshipType", "Lag", "Source", "ReviewStatus" },
            combined.Select(r => new[]
            {
                r.RelationshipId, r.PredecessorId, r.SuccessorId, r.RelationshipType.ToString(), r.Lag.ToString("0.##"), r.Source, r.ReviewStatus.ToString()
            }));
    }

    private List<Relationship> ReadLogicGeneratedSheet()
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.LogicGenerated);
        var rows = ExcelRangeIO.ReadTableAsRows(sheet);
        return rows.Select(r => new Relationship
        {
            RelationshipId = r.GetValueOrDefault("RelationshipId") ?? "",
            PredecessorId = r.GetValueOrDefault("PredecessorId") ?? "",
            SuccessorId = r.GetValueOrDefault("SuccessorId") ?? "",
            RelationshipType = Enum.TryParse<RelationshipType>(r.GetValueOrDefault("RelationshipType"), out var t) ? t : RelationshipType.FS,
            Lag = decimal.TryParse(r.GetValueOrDefault("Lag"), out var lag) ? lag : 0,
            Source = r.GetValueOrDefault("Source") ?? "Manual",
            ReviewStatus = Enum.TryParse<ReviewStatus>(r.GetValueOrDefault("ReviewStatus"), out var rs) ? rs : ReviewStatus.Manual
        }).ToList();
    }

    private List<CostStage> ReadCostStagesSheet()
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.CostStages);
        var rows = ExcelRangeIO.ReadTableAsRows(sheet);
        return rows.Select(r => new CostStage
        {
            StageName = r.GetValueOrDefault("StageName") ?? "",
            Percentage = decimal.TryParse(r.GetValueOrDefault("Percentage"), out var p) ? p : 0,
            Role = r.GetValueOrDefault("Role"),
            WBSCode = r.GetValueOrDefault("WBSCode")
        }).ToList();
    }

    private List<EngineeringDefinition> ReadEngineeringDefinitionsSheet()
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.EngineeringNames);
        var rows = ExcelRangeIO.ReadTableAsRows(sheet);
        return rows.Select(r => new EngineeringDefinition
        {
            Discipline = r.GetValueOrDefault("Discipline") ?? "",
            SubmissionDuration = decimal.TryParse(r.GetValueOrDefault("SubmissionDuration"), out var sd) ? sd : 0,
            ApprovalDuration = decimal.TryParse(r.GetValueOrDefault("ApprovalDuration"), out var ad) ? ad : 0,
            LocationFilter = r.GetValueOrDefault("LocationFilter"),
            FloorFilter = r.GetValueOrDefault("FloorFilter"),
            WBSCode = r.GetValueOrDefault("WBSCode")
        }).ToList();
    }

    private List<ProcurementFamily> ReadProcurementFamiliesSheet()
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.ProcurementFamilies);
        var rows = ExcelRangeIO.ReadTableAsRows(sheet);
        return rows.Select(r => new ProcurementFamily
        {
            FamilyCode = r.GetValueOrDefault("FamilyCode") ?? "",
            FamilyName = r.GetValueOrDefault("FamilyName") ?? "",
            SubmittalDuration = decimal.TryParse(r.GetValueOrDefault("SubmittalDuration"), out var v1) ? v1 : 0,
            ApprovalDuration = decimal.TryParse(r.GetValueOrDefault("ApprovalDuration"), out var v2) ? v2 : 0,
            POLeadTime = decimal.TryParse(r.GetValueOrDefault("POLeadTime"), out var v3) ? v3 : 0,
            FabricationDuration = decimal.TryParse(r.GetValueOrDefault("FabricationDuration"), out var v4) ? v4 : 0,
            DeliveryDuration = decimal.TryParse(r.GetValueOrDefault("DeliveryDuration"), out var v5) ? v5 : 0,
            Discipline = r.GetValueOrDefault("Discipline")
        }).ToList();
    }

    private List<ProcurementMaterial> ReadProcurementMaterialsSheet()
    {
        var sheet = ExcelRangeIO.GetOrAddSheet(ActiveWorkbook, SheetNames.ProcurementNames);
        var rows = ExcelRangeIO.ReadTableAsRows(sheet);
        return rows.Select(r => new ProcurementMaterial
        {
            MaterialName = r.GetValueOrDefault("MaterialName") ?? "",
            FamilyCode = r.GetValueOrDefault("FamilyCode") ?? "",
            ConsumingActivityId = r.GetValueOrDefault("ConsumingActivityId") ?? "",
            Excluded = bool.TryParse(r.GetValueOrDefault("Excluded"), out var ex) && ex
        }).ToList();
    }
}
