"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { formatMoney, formatPercent, formatNumber } from "@/lib/format";
import { Download, FileText } from "lucide-react";

const REPORT_TABS = [
  { key: "cost-code-analysis", label: "Cost Code Analysis" },
  { key: "boq-variance", label: "BOQ Qty/Rate Variance" },
  { key: "material-loss", label: "Material Loss" },
  { key: "subcontractors", label: "Subcontractors" },
  { key: "commitments", label: "Commitments" },
  { key: "manpower", label: "Manpower Cost" },
  { key: "equipment", label: "Equipment Cost" },
  { key: "indirect-costs", label: "Indirect Cost" },
  { key: "taxes-overhead", label: "Taxes & Overhead" },
  { key: "unallocated", label: "Unallocated Cost" },
] as const;

export default function ReportsPage() {
  const { currentProject } = useProject();
  const currency = currentProject?.currency ?? "SAR";
  const [tab, setTab] = useState<(typeof REPORT_TABS)[number]["key"]>("cost-code-analysis");

  const { data } = useQuery({
    queryKey: ["report", tab, currentProject?.id],
    queryFn: async () => (await api.get(`/projects/${currentProject!.id}/reports/${tab}`)).data,
    enabled: !!currentProject,
  });

  function downloadFile(path: string, filename: string) {
    const token = window.localStorage.getItem("ccc_token");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${currentProject!.id}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        link.click();
      });
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Cost analysis, variance, material loss, and executive reporting."
        actions={
          <>
            <button className="btn-secondary" onClick={() => downloadFile("/reports/executive/excel", "Executive-Cost-Report.xlsx")}>
              <Download size={16} /> Executive Excel
            </button>
            <button className="btn-secondary" onClick={() => downloadFile("/reports/executive/pdf", "Executive-Cost-Report.pdf")}>
              <FileText size={16} /> Executive PDF
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-800">
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            className={`px-3 py-2 text-sm ${tab === t.key ? "border-b-2 border-amber-500 text-amber-400" : "text-slate-400"}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cost-code-analysis" && (
        <DataTable
          columns={[
            { key: "code", header: "Cost Code" },
            { key: "description", header: "Description" },
            { key: "budget", header: "Budget", align: "right", render: (r: any) => formatMoney(r.budget, currency) },
            { key: "actual", header: "Actual", align: "right", render: (r: any) => formatMoney(r.actual, currency) },
            { key: "variance", header: "Variance", align: "right", render: (r: any) => formatMoney(r.variance, currency) },
            { key: "variancePercent", header: "Variance %", align: "right", render: (r: any) => formatPercent(r.variancePercent) },
          ]}
          rows={data ?? []}
        />
      )}

      {tab === "boq-variance" && (
        <DataTable
          columns={[
            { key: "itemNumber", header: "Item No." },
            { key: "description", header: "Description" },
            { key: "budgetAmount", header: "Budget Amount", align: "right", render: (r: any) => formatMoney(r.budgetAmount, currency) },
            { key: "actualAmount", header: "Actual Amount", align: "right", render: (r: any) => formatMoney(r.actualAmount, currency) },
            { key: "quantityVariance", header: "Quantity Variance", align: "right", render: (r: any) => formatMoney(r.quantityVariance, currency) },
            { key: "rateVariance", header: "Rate Variance", align: "right", render: (r: any) => formatMoney(r.rateVariance, currency) },
            { key: "totalVariance", header: "Total Variance", align: "right", render: (r: any) => formatMoney(r.totalVariance, currency) },
          ]}
          rows={data ?? []}
        />
      )}

      {tab === "material-loss" && (
        <DataTable
          columns={[
            { key: "code", header: "Material" },
            { key: "description", header: "Description" },
            { key: "allowedWastePercent", header: "Allowed Waste %", align: "right", render: (r: any) => formatPercent(r.allowedWastePercent) },
            { key: "totalLossQuantity", header: "Loss Quantity", align: "right", render: (r: any) => formatNumber(r.totalLossQuantity) },
            { key: "totalLossCost", header: "Loss Cost", align: "right", render: (r: any) => formatMoney(r.totalLossCost, currency) },
            { key: "overAllowedEvents", header: "Over-Allowed Events", align: "right" },
          ]}
          rows={data ?? []}
        />
      )}

      {tab === "subcontractors" && (
        <DataTable
          columns={[
            { key: "companyName", header: "Subcontractor" },
            { key: "contractNumber", header: "Contract No." },
            { key: "originalValue", header: "Original", align: "right", render: (r: any) => formatMoney(r.originalValue, currency) },
            { key: "revisedValue", header: "Revised", align: "right", render: (r: any) => formatMoney(r.revisedValue, currency) },
            { key: "certifiedAmount", header: "Certified", align: "right", render: (r: any) => formatMoney(r.certifiedAmount, currency) },
            { key: "remainingCommitment", header: "Remaining", align: "right", render: (r: any) => formatMoney(r.remainingCommitment, currency) },
          ]}
          rows={data ?? []}
        />
      )}

      {tab === "commitments" && (
        <DataTable
          columns={[
            { key: "number", header: "No." },
            { key: "type", header: "Type", render: (r: any) => String(r.type).replace(/_/g, " ") },
            { key: "vendorName", header: "Vendor" },
            { key: "revisedAmount", header: "Revised", align: "right", render: (r: any) => formatMoney(r.revisedAmount, currency) },
            { key: "certifiedAmount", header: "Certified", align: "right", render: (r: any) => formatMoney(r.certifiedAmount, currency) },
            { key: "remaining", header: "Remaining", align: "right", render: (r: any) => formatMoney(r.remaining, currency) },
            { key: "status", header: "Status" },
          ]}
          rows={data ?? []}
        />
      )}

      {tab === "manpower" && (
        <DataTable
          columns={[
            { key: "category", header: "Category" },
            { key: "headcount", header: "Headcount", align: "right", render: (r: any) => formatNumber(r.headcount, 0) },
            { key: "totalCost", header: "Total Cost", align: "right", render: (r: any) => formatMoney(r.totalCost, currency) },
          ]}
          rows={data ?? []}
        />
      )}

      {tab === "equipment" && (
        <DataTable
          columns={[
            { key: "equipmentName", header: "Equipment" },
            { key: "ownership", header: "Ownership" },
            { key: "operatingHours", header: "Operating Hours", align: "right", render: (r: any) => formatNumber(r.operatingHours) },
            { key: "totalCost", header: "Total Cost", align: "right", render: (r: any) => formatMoney(r.totalCost, currency) },
          ]}
          rows={data ?? []}
        />
      )}

      {tab === "indirect-costs" && (
        <DataTable
          columns={[
            { key: "category", header: "Category" },
            { key: "amount", header: "Amount", align: "right", render: (r: any) => formatMoney(r.amount, currency) },
          ]}
          rows={data ?? []}
        />
      )}

      {tab === "taxes-overhead" && data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ReportStat label="VAT Rate" value={formatPercent(data.vatRate)} />
          <ReportStat label="Net Cost (posted)" value={formatMoney(data.netCost, currency)} />
          <ReportStat label="VAT Amount" value={formatMoney(data.vatAmount, currency)} />
          <ReportStat label="Gross Cost" value={formatMoney(data.grossCost, currency)} />
          <ReportStat label={`Head Office Overhead (${data.headOfficeOverheadPercent}%)`} value={formatMoney(data.headOfficeOverhead, currency)} />
          <ReportStat label={`Insurance (${data.insuranceRate}%)`} value={formatMoney(data.insurance, currency)} />
          <ReportStat label={`Provision (${data.provisionRate}%)`} value={formatMoney(data.provision, currency)} />
          <ReportStat label="Total Taxes & Overhead" value={formatMoney(data.totalTaxesAndOverhead, currency)} />
        </div>
      )}

      {tab === "unallocated" && (
        <>
          <p className="mb-3 text-sm text-slate-400">Total unallocated: {formatMoney(data?.total ?? 0, currency)}</p>
          <DataTable
            columns={[
              { key: "date", header: "Date", render: (r: any) => new Date(r.date).toLocaleDateString() },
              { key: "description", header: "Description" },
              { key: "supplier", header: "Supplier", render: (r: any) => r.supplier ?? "-" },
              { key: "netAmount", header: "Net Amount", align: "right", render: (r: any) => formatMoney(r.netAmount, currency) },
            ]}
            rows={data?.items ?? []}
          />
        </>
      )}
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-lg font-semibold text-slate-100">{value}</span>
    </div>
  );
}
