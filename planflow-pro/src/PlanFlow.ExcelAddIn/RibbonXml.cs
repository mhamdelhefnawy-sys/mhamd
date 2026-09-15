namespace PlanFlow.ExcelAddIn;

/// <summary>
/// The "PlanFlow Pro" ribbon tab. Groups mirror the full spec so the UI shape is
/// already right for later phases; buttons still calling "OnNotImplemented" belong
/// to Phase 3 work not started yet (so nothing in the UI is silently a no-op).
/// </summary>
public static class RibbonXml
{
    public const string Xml = @"
<customUI xmlns='http://schemas.microsoft.com/office/2009/07/customui'>
  <ribbon>
    <tabs>
      <tab id='planFlowTab' label='PlanFlow Pro'>
        <group id='grpImportBoq' label='Import / BOQ'>
          <button id='btnLoadBoq' label='Load BOQ' onAction='OnLoadBoq' size='large' />
          <button id='btnValidateBoq' label='Validate BOQ' onAction='OnValidateBoq' size='large' />
          <button id='btnNumberActivities' label='Number Activities' onAction='OnNotImplemented' size='large' />
          <button id='btnStandardBank' label='Standard Bank' onAction='OnNotImplemented' size='large' />
          <button id='btnStandardProductivity' label='Standard Productivity Table' onAction='OnNotImplemented' size='large' />
        </group>
        <group id='grpAssistant' label='Assistant'>
          <button id='btnGenerateActivities' label='Generate Activities' onAction='OnGenerateActivities' size='large' />
          <button id='btnApplyReviewedPlan' label='Apply Reviewed Activity Plan' onAction='OnApplyReviewedActivityPlan' size='large' />
          <button id='btnMapBoq' label='Map BOQ' onAction='OnMapBoq' size='large' />
          <button id='btnSuggestWbs' label='Suggest WBS Codes' onAction='OnNotImplemented' size='large' />
          <button id='btnIdentifyCalendar' label='Identify Calendar' onAction='OnIdentifyCalendar' size='large' />
          <button id='btnSuggestLogic' label='Suggest Logic' onAction='OnSuggestLogic' size='large' />
        </group>
        <group id='grpCostResources' label='Cost and Resources'>
          <button id='btnApplyCostStages' label='Apply Cost Stages' onAction='OnApplyCostStages' size='large' />
          <button id='btnCalculateManpower' label='Calculate Manpower' onAction='OnCalculateManpower' size='large' />
          <button id='btnCreateManpowerResources' label='Create Manpower Resources' onAction='OnCreateManpowerResources' size='large' />
          <button id='btnIdentifyCashResource' label='Identify Cash Resource' onAction='OnIdentifyCashResource' size='large' />
        </group>
        <group id='grpEngProc' label='Engineering / Procurement'>
          <button id='btnGenerateEngineeringActivities' label='Generate Engineering Activities' onAction='OnGenerateEngineeringActivities' size='large' />
          <button id='btnGenerateProcurementList' label='Generate Procurement List' onAction='OnGenerateProcurementList' size='large' />
        </group>
        <group id='grpScheduling' label='Scheduling'>
          <button id='btnRunForwardPass' label='Run Forward Pass' onAction='OnRunForwardPass' size='large' />
          <button id='btnProjectTimeline' label='Project Timeline' onAction='OnProjectTimeline' size='large' />
        </group>
        <group id='grpXer' label='XER / Primavera'>
          <button id='btnExportFullXer' label='Export Full XER' onAction='OnExportFullXer' size='large' />
          <button id='btnImportXer' label='Import XER' onAction='OnNotImplemented' size='large' />
        </group>
        <group id='grpAbout' label='About / Settings'>
          <button id='btnBackupWorkbook' label='Backup Workbook' onAction='OnBackupWorkbook' size='large' />
          <button id='btnAuditLog' label='Audit Log' onAction='OnShowAuditLog' size='large' />
        </group>
      </tab>
    </tabs>
  </ribbon>
</customUI>";
}
