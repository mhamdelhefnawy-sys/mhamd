namespace PlanFlow.ExcelAddIn;

/// <summary>Fixed sheet names created for every new PlanFlow Pro project (spec §2).</summary>
public static class SheetNames
{
    public const string ProjectSetup = "Project_Setup";
    public const string ProjectBrief = "Project_Brief";
    public const string InputBoq = "Input_BOQ";
    public const string Locations = "Locations";
    public const string Wbs = "WBS";
    public const string WbsTree = "WBS_Tree";
    public const string AiReview = "AI_Review";
    public const string ConstructionActivityPlan = "Construction_Activity_Plan";
    public const string Splits = "Splits";
    public const string AiMapReview = "AI_MapReview";
    public const string MappingOutput = "Mapping_Output";
    public const string CostStages = "Cost_Stages";
    public const string Manpower = "Manpower";
    public const string Resources = "Resources";
    public const string EngineeringNames = "Engineering_Names";
    public const string EngineeringActivities = "Engineering_Activities";
    public const string ProcurementFamilies = "Procurement_Families";
    public const string ProcurementNames = "Procurement_Names";
    public const string ProcurementActivities = "Procurement_Activities";
    public const string Calendars = "Calendars";
    public const string Logic = "Logic";
    public const string LogicGenerated = "Logic_Generated";
    public const string AdditionalActivities = "Additional_Activities";
    public const string ProjectTimeline = "Project_Timeline";
    public const string XerImportLog = "XER_Import_Log";
    public const string ValidationReport = "Validation_Report";
    public const string AuditLog = "Audit_Log";

    public static readonly string[] All =
    {
        ProjectSetup, ProjectBrief, InputBoq, Locations, Wbs, WbsTree, AiReview,
        ConstructionActivityPlan, Splits, AiMapReview, MappingOutput, CostStages,
        Manpower, Resources, EngineeringNames, EngineeringActivities, ProcurementFamilies,
        ProcurementNames, ProcurementActivities, Calendars, Logic, LogicGenerated,
        AdditionalActivities, ProjectTimeline, XerImportLog, ValidationReport, AuditLog
    };
}
