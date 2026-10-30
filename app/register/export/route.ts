import { currentUser } from "@/lib/session";
import { registerRows } from "@/lib/services/register";
import { buildXlsx } from "@/lib/export/xlsx";
import { STATUS_LABELS } from "@/lib/constants";
import { ROUTE_LABELS, type Route } from "@/lib/routing/rules";

export async function GET(req: Request) {
  const user = await currentUser();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const rows = await registerRows(user, sp);
  const buf = await buildXlsx(
    "Register",
    [
      { header: "Code", key: "code", width: 14 }, { header: "Title", key: "title", width: 50 }, { header: "Function", key: "function", width: 22 },
      { header: "Sites", key: "sites", width: 20 }, { header: "Route", key: "route", width: 20 }, { header: "Status", key: "status", width: 18 },
      { header: "Level", key: "level", width: 8 }, { header: "5-yr benefit (INR)", key: "benefit", width: 18 }, { header: "TCO (INR)", key: "tco", width: 16 },
      { header: "Flags", key: "flags", width: 8 }, { header: "Cluster", key: "cluster", width: 24 }, { header: "Exit team", key: "exitTeam", width: 24 },
      { header: "Requester", key: "requester", width: 20 }, { header: "Owner", key: "owner", width: 20 }, { header: "Age (days)", key: "age", width: 10 },
    ],
    rows.map((r) => ({ ...r, route: r.route ? ROUTE_LABELS[r.route as Route] : "", status: STATUS_LABELS[r.status], benefit: Math.round(r.benefit), tco: Math.round(r.tco) })),
  );
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="usecase-register.xlsx"` } });
}
