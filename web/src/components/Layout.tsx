import { Link, NavLink, Outlet } from "react-router";

export default function Layout() {
  const nav = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${isActive ? "bg-brand-light text-white" : "text-slate-200 hover:text-white"}`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand text-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="flex flex-col leading-tight">
            <span className="text-lg font-bold tracking-wide">KSTVET</span>
            <span className="text-xs text-accent">Continuing Professional Development</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={nav}>CPD Calendar</NavLink>
            <NavLink to="/track" className={nav}>Track application</NavLink>
            <a href="https://www.kstvet.ac.ke" className="px-3 py-2 text-sm text-slate-200 hover:text-white">
              Main website
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-brand text-slate-300 text-sm">
        <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col sm:flex-row justify-between gap-2">
          <p>Kenya School of TVET · P.O. Box 44600-00100, Nairobi</p>
          <p>info@kstvet.ac.ke · +254 707444222</p>
        </div>
      </footer>
    </div>
  );
}