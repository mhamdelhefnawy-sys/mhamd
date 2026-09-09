import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ReportSummary } from '@/lib/engine/report';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '2px solid #1d4ed8', paddingBottom: 10 },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1d4ed8' },
  subtitle: { fontSize: 9, color: '#64748b', marginTop: 2 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 6, color: '#1e293b' },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 130, color: '#64748b' },
  value: { flex: 1, fontFamily: 'Helvetica-Bold' },
  scoreBox: { alignItems: 'flex-end' },
  scoreValue: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#1d4ed8' },
  levelValue: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  table: { marginTop: 4 },
  tr: { flexDirection: 'row', borderBottom: '1px solid #e2e8f0', paddingVertical: 4 },
  th: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#64748b' },
  td: { flex: 1, fontSize: 9 },
  bullet: { flexDirection: 'row', marginBottom: 3 },
  bulletDot: { width: 10 },
  recommendationBox: { marginTop: 14, padding: 10, backgroundColor: '#eff6ff', borderRadius: 4 },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
});

const RECOMMENDATION_LABEL: Record<string, string> = {
  STRONGLY_RECOMMENDED: 'Strongly Recommended',
  RECOMMENDED: 'Recommended',
  RECOMMENDED_WITH_DEVELOPMENT: 'Recommended with Development',
  BORDERLINE: 'Borderline',
  NOT_RECOMMENDED: 'Not Recommended',
};

export function ReportDocument({ summary }: { summary: ReportSummary }) {
  return (
    <Document title={`Assessment Report - ${summary.candidate.fullName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Planning Engineer Competency Assessment Report</Text>
            <Text style={styles.subtitle}>Planning · Primavera P6 · Project Controls</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreValue}>{summary.overallScore}%</Text>
            <Text style={styles.levelValue}>{summary.recommendedLevelLabel}</Text>
            <Text style={styles.subtitle}>Confidence: {summary.confidenceLevel}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Candidate</Text>
          <Text style={styles.value}>{summary.candidate.fullName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Current Position</Text>
          <Text style={styles.value}>{summary.candidate.currentPosition ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Target Position</Text>
          <Text style={styles.value}>{summary.candidate.targetPosition ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Assessment</Text>
          <Text style={styles.value}>
            {summary.assessment.code} · {summary.assessment.mode}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{summary.assessment.completedAt ? new Date(summary.assessment.completedAt).toLocaleDateString() : '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Duration</Text>
          <Text style={styles.value}>{summary.assessment.durationMin != null ? `${summary.assessment.durationMin} min` : '—'}</Text>
        </View>

        <Text style={styles.sectionTitle}>Competency Matrix</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>Competency</Text>
            <Text style={styles.th}>Weight</Text>
            <Text style={styles.th}>Score</Text>
            <Text style={styles.th}>Critical</Text>
          </View>
          {summary.competencyMatrix.map((c) => (
            <View style={styles.tr} key={c.code}>
              <Text style={styles.td}>{c.name}</Text>
              <Text style={styles.td}>{c.weight}%</Text>
              <Text style={styles.td}>{c.score}%</Text>
              <Text style={styles.td}>{c.isCritical ? 'Yes' : 'No'}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Strengths</Text>
        {summary.strengths.map((s, i) => (
          <View style={styles.bullet} key={i}>
            <Text style={styles.bulletDot}>•</Text>
            <Text>{s}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Development Areas</Text>
        {summary.developmentAreas.map((s, i) => (
          <View style={styles.bullet} key={i}>
            <Text style={styles.bulletDot}>•</Text>
            <Text>{s}</Text>
          </View>
        ))}

        {summary.redFlags.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Red Flags</Text>
            {summary.redFlags.map((s, i) => (
              <View style={styles.bullet} key={i}>
                <Text style={styles.bulletDot}>•</Text>
                <Text>{s}</Text>
              </View>
            ))}
          </>
        )}

        {summary.interviewerNotes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Interviewer Notes</Text>
            {summary.interviewerNotes.map((s, i) => (
              <View style={styles.bullet} key={i}>
                <Text style={styles.bulletDot}>•</Text>
                <Text>{s}</Text>
              </View>
            ))}
          </>
        )}

        <View style={styles.recommendationBox}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>Final Recommendation: {RECOMMENDATION_LABEL[summary.recommendation]}</Text>
        </View>

        <Text style={styles.footer} fixed>
          Generated by the Planning Engineer Competency Assessment Platform · This report reflects assessment-engine analytical results, not a certified Primavera P6 scheduling determination.
        </Text>
      </Page>
    </Document>
  );
}
