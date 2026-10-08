import { useState } from "react";
import type { ChangeEvent } from "react";
import {
  BooleanField, BooleanInput, Create, Datagrid, Edit, List, NullableBooleanInput, NumberField,
  NumberInput, SearchInput, SelectField, SelectInput, SimpleForm, TextField, TextInput, minValue,
  required, useNotify, useRecordContext, useRefresh,
} from "react-admin";
import { Box, Button as MuiButton, Card, CardContent, Link as MuiLink, Typography } from "@mui/material";

import { adminFetch } from "./http";

export const modeChoices = [
  { id: "physical", name: "Physical" },
  { id: "online", name: "Online" },
  { id: "blended", name: "Blended" },
];

const filters = [
  <SearchInput source="q" alwaysOn key="q" />,
  <NullableBooleanInput source="is_published" label="Published" alwaysOn key="pub" />,
];

export function ProgrammeList() {
  return (
    <List filters={filters} sort={{ field: "title", order: "ASC" }} exporter={false}>
      <Datagrid rowClick="edit" bulkActionButtons={false}>
        <TextField source="title" />
        <TextField source="category" />
        <SelectField source="mode" choices={modeChoices} sortable={false} />
        <NumberField source="fee_kes" label="Fee" locales="en-KE" options={{ style: "currency", currency: "KES", maximumFractionDigits: 0 }} />
        <BooleanField source="is_published" label="Published" sortable={false} />
        <NumberField source="intake_count" label="Intakes" sortable={false} />
      </Datagrid>
    </List>
  );
}

function ProgrammeForm() {
  return (
    <SimpleForm>
      <TextInput source="title" validate={required()} fullWidth />
      <TextInput source="slug" helperText="Web address name, e.g. digital-skills. Leave blank to generate from the title." fullWidth />
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", width: "100%" }}>
        <TextInput source="category" validate={required()} />
        <SelectInput source="mode" choices={modeChoices} validate={required()} />
        <TextInput source="duration_text" label="Duration" helperText='e.g. "5 days"' validate={required()} />
        <NumberInput source="cpd_hours" label="CPD hours" />
        <NumberInput source="fee_kes" label="Fee (KES)" validate={[required(), minValue(0)]} />
      </Box>
      <TextInput source="summary" multiline minRows={2} fullWidth validate={required()} helperText="One or two sentences shown on the calendar." />
      <TextInput source="description" multiline minRows={4} fullWidth />
      <TextInput source="target_audience" label="Who should attend" multiline minRows={2} fullWidth />
      <TextInput source="learning_outcomes" multiline minRows={3} fullWidth helperText="One outcome per line." />
      <BooleanInput source="is_published" label="Published (visible on the CPD Calendar)" />
    </SimpleForm>
  );
}

function BrochureAside() {
  const record = useRecordContext();
  const notify = useNotify();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  if (!record) return null;

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try {
      await adminFetch(`/programmes/${record.id}/brochure`, { method: "POST", body: fd });
      notify("Brochure uploaded", { type: "success" });
      refresh();
    } catch (err) {
      notify((err as Error).message, { type: "error" });
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <Card sx={{ ml: 2, width: 260, alignSelf: "flex-start" }}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Brochure (PDF)</Typography>
        <Typography variant="body2" sx={{ my: 1 }}>
          {record.has_brochure ? (
            <MuiLink href={`/api/programmes/${record.slug}/brochure`} target="_blank">View current brochure</MuiLink>
          ) : (
            "No brochure uploaded."
          )}
        </Typography>
        <MuiButton component="label" variant="outlined" size="small" disabled={busy}>
          {busy ? "Uploading…" : record.has_brochure ? "Replace PDF" : "Upload PDF"}
          <input hidden type="file" accept="application/pdf" onChange={onChange} />
        </MuiButton>
        <Typography variant="caption" sx={{ display: "block", mt: 1 }} color="text.secondary">
          The link works publicly only while the programme is published.
        </Typography>
      </CardContent>
    </Card>
  );
}

export function ProgrammeCreate() {
  return (
    <Create redirect="edit">
      <ProgrammeForm />
    </Create>
  );
}

export function ProgrammeEdit() {
  return (
    <Edit mutationMode="pessimistic" aside={<BrochureAside />}>
      <ProgrammeForm />
    </Edit>
  );
}