import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { Title, useNotify } from "react-admin";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";

import { adminFetch } from "./http";

type Settings = {
  letter_signatory_name: string;
  letter_signatory_title: string;
  payment_instructions: string;
  cpd_office_email: string;
  cpd_office_phone: string;
  has_signature: boolean;
};
type Key = Exclude<keyof Settings, "has_signature">;

const FIELDS: { key: Key; label: string; multiline?: boolean }[] = [
  { key: "letter_signatory_name", label: "Signatory name" },
  { key: "letter_signatory_title", label: "Signatory title" },
  { key: "payment_instructions", label: "Payment instructions (shown in the letter)", multiline: true },
  { key: "cpd_office_email", label: "CPD Office email" },
  { key: "cpd_office_phone", label: "CPD Office phone" },
];

export default function SettingsPage() {
  const notify = useNotify();
  const query = useQuery({ queryKey: ["admin-settings"], queryFn: () => adminFetch<Settings>("/settings") });
  const [form, setForm] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

  if (!form) return <Typography sx={{ p: 2 }}>Loading…</Typography>;

  const save = async () => {
    setBusy(true);
    try {
      setForm(await adminFetch<Settings>("/settings", { method: "PUT", body: JSON.stringify(form) }));
      notify("Settings saved. New letters will use them.", { type: "success" });
    } catch (e) {
      notify((e as Error).message, { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const uploadSignature = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try {
      setForm(await adminFetch<Settings>("/settings/signature", { method: "POST", body: fd }));
      notify("Signature uploaded", { type: "success" });
    } catch (err) {
      notify((err as Error).message, { type: "error" });
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <Card sx={{ mt: 2, maxWidth: 760 }}>
      <Title title="Letter settings" />
      <CardContent>
        <Stack sx={{ gap: 2 }}>
          {FIELDS.map((f) => (
            <TextField
              key={f.key}
              label={f.label}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              multiline={f.multiline}
              minRows={f.multiline ? 3 : undefined}
              fullWidth
            />
          ))}
          <Box>
            <Typography variant="subtitle2">Signature image</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {form.has_signature ? "A signature is uploaded and printed on letters." : "No signature uploaded; letters show a blank space."}
              {" "}PNG or JPG, transparent background works best, max 1 MB.
            </Typography>
            <Button component="label" variant="outlined" size="small" disabled={busy}>
              {form.has_signature ? "Replace signature" : "Upload signature"}
              <input hidden type="file" accept="image/png,image/jpeg" onChange={uploadSignature} />
            </Button>
          </Box>
          <Box>
            <Button variant="contained" onClick={save} disabled={busy}>Save settings</Button>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Changes apply to letters issued or regenerated from now on.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}