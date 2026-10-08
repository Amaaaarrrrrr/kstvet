import { Link } from "react-router";
import { Title, useBasename } from "react-admin";
import { useQuery } from "@tanstack/react-query";
import {
  Card, CardContent, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";

import { adminFetch } from "./http";

type Summary = {
  totals: Record<string, number>;
  intakes: { intake_id: number; programme_title: string; start_date: string; capacity: number | null;
             status: string; applications: number; admitted: number }[];
};

const TILES = [
  ["applications", "Total applications"], ["submitted", "Awaiting review"],
  ["under_review", "Under review"], ["admitted", "Admitted"], ["rejected", "Rejected"],
] as const;

export default function Dashboard() {
  const basename = useBasename();
  const { data, isPending, error } = useQuery({
    queryKey: ["admin-summary"],
    queryFn: () => adminFetch<Summary>("/reports/summary"),
  });

  const appsLink = (filter: object) =>
    `${basename}/applications?filter=${encodeURIComponent(JSON.stringify(filter))}`;

  return (
    <Stack sx={{ gap: 2, mt: 2 }}>
      <Title title="KSTVET CPD Dashboard" />
      {isPending && <Typography>Loading…</Typography>}
      {error && <Typography color="error">{(error as Error).message}</Typography>}
      {data && (
        <>
          <Stack direction="row" useFlexGap sx={{ gap: 2, flexWrap: "wrap" }}>
            {TILES.map(([key, label]) => (
              <Card key={key} sx={{ flex: "1 1 160px" }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h4">
                    {key === "applications" ? (
                      data.totals[key] ?? 0
                    ) : (
                      <Link to={appsLink({ status: key })} style={{ color: "inherit", textDecoration: "none" }}>
                        {data.totals[key] ?? 0}
                      </Link>
                    )}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Upcoming intakes</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Programme</TableCell>
                    <TableCell>Starts</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Applications</TableCell>
                    <TableCell align="right">Admitted / capacity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.intakes.map((i) => (
                    <TableRow key={i.intake_id} hover>
                      <TableCell>
                        <Link to={appsLink({ intake_id: i.intake_id })}>{i.programme_title}</Link>
                      </TableCell>
                      <TableCell>{i.start_date}</TableCell>
                      <TableCell>{i.status}</TableCell>
                      <TableCell align="right">{i.applications}</TableCell>
                      <TableCell align="right">{i.admitted}{i.capacity ? ` / ${i.capacity}` : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  );
}