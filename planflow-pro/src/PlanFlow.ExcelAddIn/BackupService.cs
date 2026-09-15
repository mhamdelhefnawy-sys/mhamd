using Microsoft.Office.Interop.Excel;

namespace PlanFlow.ExcelAddIn;

/// <summary>
/// Copies the workbook file to a timestamped .bak before any operation the spec
/// classifies as "مؤثرة" (Apply Reviewed Plan, Split Progress, Fix Resource
/// Assignments, XER export/import, etc). Restore just re-opens the backup file.
/// </summary>
public static class BackupService
{
    public static string? Backup(Workbook workbook)
    {
        if (string.IsNullOrEmpty(workbook.FullName) || !workbook.Saved && string.IsNullOrEmpty(workbook.Path))
        {
            // Unsaved new workbook: nothing on disk to copy yet. Caller should prompt Save first.
            return null;
        }

        var directory = System.IO.Path.Combine(workbook.Path, "PlanFlowBackups");
        System.IO.Directory.CreateDirectory(directory);

        var backupName = $"{System.IO.Path.GetFileNameWithoutExtension(workbook.Name)}_{DateTime.Now:yyyyMMdd_HHmmss}.bak.xlsx";
        var backupPath = System.IO.Path.Combine(directory, backupName);

        workbook.Save();
        System.IO.File.Copy(workbook.FullName, backupPath, overwrite: false);
        return backupPath;
    }
}
