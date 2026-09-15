namespace PlanFlow.Core.Boq;

/// <summary>
/// Maps arbitrary source-file column headers to the BOQ core fields, for when the
/// uploaded XLSX/CSV doesn't already use PlanFlow's own header names.
/// </summary>
public sealed class BoqColumnMapping
{
    public string CodeColumn { get; set; } = "Code";
    public string DescriptionColumn { get; set; } = "Description";
    public string UnitColumn { get; set; } = "Unit";
    public string QuantityColumn { get; set; } = "Quantity";
    /// <summary>Either a unit Rate column (TotalCost = Quantity * Rate) or a direct Cost column.</summary>
    public string? RateColumn { get; set; } = "Rate";
    public string? CostColumn { get; set; }
    public string? LongDescriptionColumn { get; set; }

    public static BoqColumnMapping Default() => new();
}
