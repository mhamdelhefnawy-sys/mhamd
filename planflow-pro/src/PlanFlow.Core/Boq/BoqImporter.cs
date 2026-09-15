using System.Globalization;
using PlanFlow.Core.Common;
using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Boq;

/// <summary>
/// Turns raw header/value rows (already read from an XLSX/CSV by the Excel add-in layer)
/// into validated <see cref="BoqItem"/> rows. Kept independent of any file-format library
/// so it can be unit tested without Excel.
/// </summary>
public sealed class BoqImporter
{
    public sealed class ImportOutcome
    {
        public IReadOnlyList<BoqItem> Items { get; init; } = Array.Empty<BoqItem>();
        public ValidationResult Validation { get; init; } = new();
    }

    public ImportOutcome Import(IReadOnlyList<IReadOnlyDictionary<string, string?>> rows, BoqColumnMapping mapping)
    {
        var items = new List<BoqItem>(rows.Count);
        var validation = new ValidationResult();

        for (var i = 0; i < rows.Count; i++)
        {
            var rowNumber = i + 2; // header is row 1
            var row = rows[i];

            var item = new BoqItem
            {
                OriginalRow = rowNumber,
                BOQCode = GetString(row, mapping.CodeColumn),
                Description = GetString(row, mapping.DescriptionColumn),
                LongDescription = mapping.LongDescriptionColumn is null ? null : GetString(row, mapping.LongDescriptionColumn),
                Unit = GetString(row, mapping.UnitColumn),
                Status = ReviewStatus.Manual
            };

            item.Quantity = ParseDecimal(row, mapping.QuantityColumn, rowNumber, validation);

            if (!string.IsNullOrEmpty(mapping.CostColumn) && row.ContainsKey(mapping.CostColumn))
            {
                item.TotalCost = ParseDecimal(row, mapping.CostColumn, rowNumber, validation);
                item.Rate = item.Quantity != 0 ? item.TotalCost / item.Quantity : 0;
            }
            else if (!string.IsNullOrEmpty(mapping.RateColumn))
            {
                item.Rate = ParseDecimal(row, mapping.RateColumn, rowNumber, validation);
                item.TotalCost = item.Quantity * item.Rate;
            }

            items.Add(item);
        }

        validation.AddRange(BoqValidator.Validate(items).Issues);

        return new ImportOutcome { Items = items, Validation = validation };
    }

    private static string GetString(IReadOnlyDictionary<string, string?> row, string column) =>
        row.TryGetValue(column, out var value) ? value?.Trim() ?? string.Empty : string.Empty;

    private static decimal ParseDecimal(IReadOnlyDictionary<string, string?> row, string column, int rowNumber, ValidationResult validation)
    {
        var raw = GetString(row, column);
        if (string.IsNullOrWhiteSpace(raw)) return 0;

        if (decimal.TryParse(raw, NumberStyles.Number, CultureInfo.InvariantCulture, out var value))
            return value;

        validation.Add(ValidationIssue.Error("BOQ_NUMBER_FORMAT", $"'{raw}' in column '{column}' is not a valid number.", rowNumber, column));
        return 0;
    }
}
