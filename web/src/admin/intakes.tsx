import {
  AutocompleteInput, Create, Datagrid, DateField, DateInput, Edit, FunctionField, List, NumberInput,
  ReferenceInput, SelectField, SelectInput, SimpleForm, TextField, TextInput, minValue, required,
} from "react-admin";
import type { RaRecord } from "react-admin";
import { Box } from "@mui/material";

export const intakeStatusChoices = [
  { id: "open", name: "Open" },
  { id: "closed", name: "Closed" },
  { id: "full", name: "Full" },
  { id: "cancelled", name: "Cancelled" },
];

const filters = [
  <ReferenceInput source="programme_id" reference="programmes" alwaysOn key="prog" sort={{ field: "title", order: "ASC" }}>
    <AutocompleteInput optionText="title" label="Programme" />
  </ReferenceInput>,
  <SelectInput source="status" choices={intakeStatusChoices} alwaysOn key="status" />,
];

export function IntakeList() {
  return (
    <List filters={filters} sort={{ field: "start_date", order: "ASC" }} exporter={false}>
      <Datagrid rowClick="edit" bulkActionButtons={false}>
        <TextField source="programme_title" label="Programme" sortBy="programme_title" />
        <DateField source="start_date" label="Starts" locales="en-GB" />
        <DateField source="end_date" label="Ends" locales="en-GB" sortable={false} />
        <DateField source="application_deadline" label="Apply by" locales="en-GB" />
        <TextField source="venue" sortable={false} />
        <SelectField source="status" choices={intakeStatusChoices} />
        <FunctionField
          label="Applications"
          render={(r: RaRecord) => `${r.application_count} (admitted ${r.admitted_count}${r.capacity ? ` / ${r.capacity}` : ""})`}
        />
      </Datagrid>
    </List>
  );
}

function IntakeForm() {
  return (
    <SimpleForm>
      <ReferenceInput source="programme_id" reference="programmes" sort={{ field: "title", order: "ASC" }}>
        <AutocompleteInput optionText="title" label="Programme" validate={required()} fullWidth />
      </ReferenceInput>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <DateInput source="start_date" validate={required()} />
        <DateInput source="end_date" validate={required()} />
        <DateInput source="application_deadline" label="Application deadline" validate={required()} />
      </Box>
      <TextInput source="venue" validate={required()} fullWidth defaultValue="KSTVET Campus, Nairobi" />
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <NumberInput source="capacity" validate={minValue(1)} helperText="Leave blank for no limit" />
        <TextInput source="reporting_time" helperText='e.g. "8:00 AM"' />
        <SelectInput source="status" choices={intakeStatusChoices} defaultValue="open" validate={required()} />
      </Box>
    </SimpleForm>
  );
}

export function IntakeCreate() {
  return (
    <Create redirect="list">
      <IntakeForm />
    </Create>
  );
}

export function IntakeEdit() {
  return (
    <Edit mutationMode="pessimistic">
      <IntakeForm />
    </Edit>
  );
}