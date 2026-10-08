import { useState } from "react";
import type { ReactNode } from "react";
import {
  AutocompleteInput, Datagrid, DateField, Edit, FilterButton, List, ReferenceInput, SaveButton,
  SearchInput, SelectInput, SimpleForm, TextField, TextInput, Toolbar, TopToolbar, required,
  useListContext, useNotify, useRecordContext, useRefresh,
} from "react-admin";
import type { RaRecord } from "react-admin";
import { useWatch } from "react-hook-form";
import { Box, Button as MuiButton, Chip, CircularProgress, Divider, Link as MuiLink, Stack, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";

import { adminFetch } from "./http";

export const statusChoices = [
  { id: "submitted", name: "Submitted" },
  { id: "under_review", name: "Under review" },
  { id: "admitted", name: "Admitted" },
  { id: "rejected", name: "Rejected" },
  { id: "withdrawn", name: "Withdrawn" },
];

const STATUS_COLOR: Record<string, "default" | "info" | "warning" | "success" | "error"> = {
  submitted: "info", under_review: "warning", admitted: "success", rejected: "error", withdrawn: "default",
};

const DOC_LABELS: Record<string, string> = {
  national_id: "National ID / Passport", academic_cert: "Academic certificate",
  professional_cert: "Professional certificate", cv: "CV", sponsorship_letter: "Sponsorship letter",
};

export const intakeLabel = (r: RaRecord) => `${r.programme_title} – ${r.start_date}`;
const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB") : "—");

// ---------- List ----------

export function StatusChip(_props: { label?: string; source?: string; sortable?: boolean }) {
  const record = useRecordContext();
  if (!record) return null;
  const choice = statusChoices.find((c) => c.id === record.status);
  return <Chip size="small" label={choice?.name ?? record.status} color={STATUS_COLOR[record.status] ?? "default"} />;
}

function CsvExportButton() {
  const { filterValues } = useListContext();
  const qs = new URLSearchParams();
  Object.entries(filterValues ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  return (
    <MuiButton size="small" startIcon={<DownloadIcon />} href={`/api/admin/exports/applications.csv?${qs}`}>
      Export CSV
    </MuiButton>
  );
}

const applicationFilters = [
  <SearchInput source="q" alwaysOn key="q" placeholder="Name, ID, email or reference" />,
  <SelectInput source="status" choices={statusChoices} alwaysOn key="status" />,
  <ReferenceInput source="intake_id" reference="intakes" key="intake" label="Intake" sort={{ field: "start_date", order: "ASC" }}>
    <AutocompleteInput optionText={intakeLabel} label="Intake" />
  </ReferenceInput>,
];

export function ApplicationList() {
  return (
    <List
      filters={applicationFilters}
      sort={{ field: "submitted_at", order: "DESC" }}
      exporter={false}
      actions={<TopToolbar><FilterButton /><CsvExportButton /></TopToolbar>}
    >
      <Datagrid rowClick="edit" bulkActionButtons={false}>
        <TextField source="reference_no" label="Reference" />
        <TextField source="applicant_name" label="Applicant" sortBy="surname" />
        <TextField source="id_number" label="ID No." sortable={false} />
        <TextField source="programme_title" label="Programme" sortable={false} />
        <DateField source="intake_start_date" label="Intake" sortable={false} locales="en-GB" />
        <StatusChip label="Status" source="status" />
        <DateField source="submitted_at" label="Submitted" showTime locales="en-GB" />
      </Datagrid>
    </List>
  );
}

// ---------- Review page ----------

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ flex: "1 1 200px", minWidth: 180 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ wordBreak: "break-word" }}>{value || "—"}</Typography>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: 3, width: "100%" }}>
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>{title}</Typography>
      <Stack direction="row" useFlexGap sx={{ gap: 2, flexWrap: "wrap" }}>{children}</Stack>
    </Box>
  );
}

// react-admin renders the list row as a placeholder while getOne is in flight;
// the nested fields only exist on the full record.
const isFullRecord = (r?: RaRecord) => Boolean(r?.applicant && r?.intake && r?.documents);

function DetailsLoading() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 4, width: "100%" }}>
      <CircularProgress size={28} />
    </Box>
  );
}

function LetterPanel() {
  const r = useRecordContext();
  const notify = useNotify();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  if (!r || !isFullRecord(r)) return <DetailsLoading />;

  if (!r.letter) {
    return (
      <Typography variant="body2" color="text.secondary">
        No admission letter yet. Set the status to Admitted below to generate and email it.
      </Typography>
    );
  }

  const act = async (action: "regenerate" | "resend") => {
    setBusy(true);
    try {
      await adminFetch(`/applications/${r.id}/letter/${action}`, { method: "POST" });
      notify(action === "resend" ? "Admission letter emailed again" : "Admission letter regenerated", { type: "success" });
      refresh();
    } catch (e) {
      notify((e as Error).message, { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack sx={{ gap: 2, width: "100%" }}>
      <Stack direction="row" useFlexGap sx={{ gap: 2, flexWrap: "wrap" }}>
        <Info label="Letter number" value={r.letter.letter_no} />
        <Info label="Issued" value={fmtDateTime(r.letter.issued_at)} />
        <Info label="Emailed" value={fmtDateTime(r.letter.emailed_at)} />
        <Info label="Downloads by applicant" value={String(r.letter.download_count)} />
      </Stack>
      <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
        <MuiButton variant="outlined" size="small" href={`/api/admin/applications/${r.id}/letter`} target="_blank">View PDF</MuiButton>
        <MuiButton variant="outlined" size="small" disabled={busy} onClick={() => act("regenerate")}>Regenerate</MuiButton>
        <MuiButton variant="outlined" size="small" disabled={busy} onClick={() => act("resend")}>Resend email</MuiButton>
      </Stack>
    </Stack>
  );
}

function ApplicationDetails() {
  const r = useRecordContext();
  if (!r || !isFullRecord(r)) return <DetailsLoading />;
  const ap = r.applicant;
  const it = r.intake;
  return (
    <Box sx={{ width: "100%" }}>
      <Section title="Programme">
        <Info label="Programme" value={it.programme_title} />
        <Info label="Dates" value={`${it.start_date} to ${it.end_date}`} />
        <Info label="Venue" value={it.venue} />
        <Info label="Fee" value={`KES ${Number(it.fee_kes).toLocaleString("en-KE")}`} />
      </Section>
      <Section title="Applicant">
        <Info label="Name" value={[ap.title, ap.first_name, ap.middle_name, ap.surname].filter(Boolean).join(" ")} />
        <Info label="ID / Passport" value={ap.id_number} />
        <Info label="Gender" value={ap.gender} />
        <Info label="Date of birth" value={ap.date_of_birth} />
        <Info label="Nationality" value={ap.nationality} />
        <Info label="Phone" value={ap.phone} />
        <Info label="Email" value={<MuiLink href={`mailto:${ap.email}`}>{ap.email}</MuiLink>} />
        <Info label="County" value={ap.county} />
        <Info label="Postal address" value={ap.postal_address} />
      </Section>
      <Section title="Academic & professional">
        <Info label="Highest qualification" value={r.highest_qualification} />
        <Info label="Institution" value={r.institution} />
        <Info label="Year completed" value={r.year_completed} />
        <Info label="Employer" value={r.employer} />
        <Info label="Job title" value={r.job_title} />
        <Info label="Professional body" value={r.professional_body} />
        <Info label="Membership no." value={r.membership_no} />
        <Info label="Sponsorship" value={r.sponsorship === "employer" ? "Employer" : "Self"} />
      </Section>
      <Section title="Other">
        <Info label="Special needs" value={r.special_needs} />
        <Info label="Heard about us via" value={r.how_heard} />
        <Info label="Submitted" value={fmtDateTime(r.submitted_at)} />
      </Section>
      <Section title="Documents">
        {r.documents.length === 0 && <Typography variant="body2">No documents.</Typography>}
        {r.documents.map((d: RaRecord) => (
          <Info
            key={d.id}
            label={DOC_LABELS[d.doc_type] ?? d.doc_type}
            value={<MuiLink href={d.url} target="_blank" rel="noopener">{d.original_name}</MuiLink>}
          />
        ))}
      </Section>
      <Section title="Admission letter">
        <LetterPanel />
      </Section>
    </Box>
  );
}

function StatusInput() {
  const r = useRecordContext();
  // Once a letter exists the status is locked to Admitted (the API enforces this too).
  // Until the full record loads we can't know whether a letter exists, so keep the input disabled.
  const loading = !isFullRecord(r);
  const choices = statusChoices.map((c) => ({ ...c, disabled: Boolean(r?.letter) && c.id !== "admitted" }));
  return (
    <SelectInput
      source="status"
      choices={choices}
      disabled={loading}
      validate={required()}
      helperText="Setting Admitted generates the admission letter and emails it to the applicant."
    />
  );
}

function DecisionToolbar() {
  const r = useRecordContext();
  const status = useWatch({ name: "status" });
  const admitting = status === "admitted" && r?.status !== "admitted";
  return (
    <Toolbar>
      <SaveButton
        label={admitting ? "Admit & send letter" : "Save"}
        onClick={(e) => {
          if (
            admitting &&
            !window.confirm("Admit this applicant? The admission letter will be generated and emailed immediately. This cannot be undone.")
          ) {
            e.preventDefault();
          }
        }}
      />
    </Toolbar>
  );
}

function EditTitle() {
  const r = useRecordContext();
  return <span>{r ? `Application ${r.reference_no}` : "Application"}</span>;
}

export function ApplicationEdit() {
  return (
    <Edit mutationMode="pessimistic" actions={false} title={<EditTitle />}>
      <SimpleForm toolbar={<DecisionToolbar />}>
        <ApplicationDetails />
        <Divider flexItem sx={{ my: 2 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Decision</Typography>
        <StatusInput />
        <TextInput source="admin_notes" label="Internal notes (not shown to the applicant)" multiline minRows={3} fullWidth />
      </SimpleForm>
    </Edit>
  );
}