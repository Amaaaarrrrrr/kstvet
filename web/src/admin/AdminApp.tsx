import type { ReactNode } from "react";
import { Admin, CustomRoutes, Layout, Menu, Resource, defaultTheme, useBasename, usePermissions } from "react-admin";
import { Route } from "react-router";
import AssignmentIcon from "@mui/icons-material/Assignment";
import EventIcon from "@mui/icons-material/Event";
import SchoolIcon from "@mui/icons-material/School";
import SettingsIcon from "@mui/icons-material/Settings";

import { ApplicationEdit, ApplicationList, intakeLabel } from "./applications";
import { authProvider } from "./authProvider";
import Dashboard from "./Dashboard";
import { dataProvider } from "./dataProvider";
import { IntakeCreate, IntakeEdit, IntakeList } from "./intakes";
import { ProgrammeCreate, ProgrammeEdit, ProgrammeList } from "./programmes";
import SettingsPage from "./SettingsPage";

const theme = {
  ...defaultTheme,
  palette: { ...defaultTheme.palette, primary: { main: "#14234b" }, secondary: { main: "#24386e" } },
};

function AdminMenu() {
  const basename = useBasename();
  const { permissions } = usePermissions();
  return (
    <Menu>
      <Menu.DashboardItem />
      <Menu.ResourceItems />
      {permissions === "admin" && (
        <Menu.Item to={`${basename}/settings`} primaryText="Letter settings" leftIcon={<SettingsIcon />} />
      )}
    </Menu>
  );
}

function AdminLayout({ children }: { children: ReactNode }) {
  return <Layout menu={AdminMenu}>{children}</Layout>;
}

export default function AdminApp() {
  return (
    <Admin
      basename="/admin"
      title="KSTVET CPD Admin"
      dataProvider={dataProvider}
      authProvider={authProvider}
      dashboard={Dashboard}
      layout={AdminLayout}
      theme={theme}
      requireAuth
      disableTelemetry
    >
      <Resource name="applications" list={ApplicationList} edit={ApplicationEdit} icon={AssignmentIcon} recordRepresentation="reference_no" />
      <Resource name="programmes" list={ProgrammeList} create={ProgrammeCreate} edit={ProgrammeEdit} icon={SchoolIcon} recordRepresentation="title" />
      <Resource name="intakes" list={IntakeList} create={IntakeCreate} edit={IntakeEdit} icon={EventIcon} recordRepresentation={intakeLabel} />
      <CustomRoutes>
        <Route path="/settings" element={<SettingsPage />} />
      </CustomRoutes>
    </Admin>
  );
}