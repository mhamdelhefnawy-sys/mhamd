using Microsoft.Office.Interop.Excel;

namespace PlanFlow.ExcelAddIn;

/// <summary>Small helpers to move data between a sheet's used range and plain .NET collections,
/// so the Core layer never has to know about the Excel Object Model.</summary>
public static class ExcelRangeIO
{
    /// <summary>net48 doesn't ship System.Collections.Generic.CollectionExtensions.GetValueOrDefault.</summary>
    public static string? GetValueOrDefault(this IReadOnlyDictionary<string, string?> dict, string key) =>
        dict.TryGetValue(key, out var value) ? value : null;

    public static List<Dictionary<string, string?>> ReadTableAsRows(Worksheet sheet)
    {
        var used = sheet.UsedRange;
        var values = (object[,])used.Value2;
        var rowCount = values.GetLength(0);
        var colCount = values.GetLength(1);

        var headers = new string[colCount + 1];
        for (var c = 1; c <= colCount; c++)
            headers[c] = Convert.ToString(values[1, c]) ?? string.Empty;

        var rows = new List<Dictionary<string, string?>>();
        for (var r = 2; r <= rowCount; r++)
        {
            var row = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            for (var c = 1; c <= colCount; c++)
                row[headers[c]] = values[r, c] is null ? null : Convert.ToString(values[r, c]);
            rows.Add(row);
        }

        return rows;
    }

    public static void WriteRows(Worksheet sheet, string[] headers, IEnumerable<string[]> rows)
    {
        sheet.Cells.Clear();
        for (var c = 0; c < headers.Length; c++)
            sheet.Cells[1, c + 1] = headers[c];

        var r = 2;
        foreach (var row in rows)
        {
            for (var c = 0; c < row.Length; c++)
                sheet.Cells[r, c + 1] = row[c];
            r++;
        }
    }

    public static Worksheet GetOrAddSheet(Workbook workbook, string name)
    {
        foreach (Worksheet sheet in workbook.Worksheets)
            if (sheet.Name == name) return sheet;

        var added = (Worksheet)workbook.Worksheets.Add();
        added.Name = name;
        return added;
    }
}
