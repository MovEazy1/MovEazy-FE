/**
 * CRM → QR scans. Every scan of a partner's To-Let poster (crm_qr_scans,
 * partner_qr_leads.sql): which brokers get the most, the hotspot areas, and a
 * map of where tenants were when they signed in on a broker's page (only
 * those who allowed their location).
 *
 *   QR scans     a phone opening the poster's QR, once a day
 *   Signed in    tenants who signed in with a number on a broker's page
 *   Leads        those who became a broker's QR lead; visit requests below
 *   Areas        GPS check-ins by nearest locality + scans counted by the
 *                poster spot the broker said it was pasted in
 */
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { Btn, C, Chip, Empty, Loading, relTime } from "./crmUi";
import { fetchQrScans } from "../../lib/qrLeads";
import { waLink } from "../../lib/partners";

const QrScanMap = lazy(() => import("./QrScanMap"));
const RANGES = [[7, "Last 7 days"], [30, "Last 30 days"], [null, "All time"]];

export default function CrmQrScansPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      setData(await fetchQrScans(days));
    } catch (e) {
      setErr(e?.message || "Could not load QR scans.");
    }
  }, [days]);
  useEffect(() => { setData(null); load(); }, [load]);

  const t = data?.totals || {};
  const cell = { padding: "9px 8px", borderBottom: `1px solid ${C.lineSoft}`, verticalAlign: "top", fontSize: 13 };
  const th = { ...cell, color: C.textMute, fontWeight: 600, fontSize: 12, textAlign: "left", background: C.surface, whiteSpace: "nowrap" };
  const num = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const thn = { ...th, textAlign: "right" };

  return (
    <div style={{ padding: 20, maxWidth: 1200 }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 20, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
        <QrCode size={20} color={C.accent} /> QR scans
      </h1>
      <p style={{ margin: "0 0 14px", color: C.textDim, fontSize: 13 }}>
        Scans of partners&apos; To-Let posters: which brokers get the most, where the hotspots are, and who became a lead.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {RANGES.map(([d, label]) => <Chip key={label} on={days === d} onClick={() => setDays(d)}>{label}</Chip>)}
        <Btn sm onClick={load}>Refresh</Btn>
      </div>
      {err && <Empty>{err}</Empty>}
      {!data && !err ? <Loading /> : data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
            {[["QR scans", t.scans, `${t.scanners ?? 0} phones · ${t.brokers ?? 0} brokers`], ["Signed in", t.signed_in, `${t.located ?? 0} shared location`],
              ["Leads", t.leads, "in brokers' My leads"], ["Visit requests", t.visits, "Schedule visit taps"]].map(([k, v, sub]) => (
              <div key={k} style={{ background: C.surface, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 12, color: C.textMute }}>{k}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{v ?? 0}</div>
                <div style={{ fontSize: 11.5, color: C.textMute }}>{sub}</div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 15, margin: "0 0 8px", color: C.text }}>Map</h2>
          <div style={{ height: 420, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}`, marginBottom: 6, background: C.surface }}>
            <Suspense fallback={<Loading label="Loading the map…" />}><QrScanMap points={data.points} /></Suspense>
          </div>
          <p style={{ margin: "0 0 18px", color: C.textMute, fontSize: 12 }}>
            Green dots: tenants who signed in and shared their location (solid = became a lead). Red zones: 2 or more within about a kilometre.
            {data.points.length === 0 ? " No located scans in this period yet." : ""}
          </p>

          <div className="crm-stack" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
            <section>
              <h2 style={{ fontSize: 15, margin: "0 0 8px", color: C.text }}>Brokers with the most scans</h2>
              {data.brokers.length === 0 ? <Empty pad={20}>No scans yet.</Empty> : (
                <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={th}>#</th><th style={th}>Broker</th><th style={thn}>Scans</th><th style={thn}>Signed in</th>
                      <th style={thn}>Leads</th><th style={thn}>Visits</th><th style={thn}>Spots</th><th style={th}>Last scan</th></tr></thead>
                    <tbody>
                      {data.brokers.map((b, i) => (
                        <tr key={b.broker_id}>
                          <td style={{ ...cell, color: C.textMute }}>{i + 1}</td>
                          <td style={cell}><b>{b.name || "—"}</b><br />
                            {b.phone ? <a href={waLink(b.phone, "")} target="_blank" rel="noreferrer" style={{ color: C.wa, fontSize: 12 }}>{b.agency || b.phone}</a>
                              : <span style={{ color: C.textMute, fontSize: 12 }}>{b.agency}</span>}</td>
                          <td style={num}><b>{b.scans}</b><br /><span style={{ color: C.textMute, fontSize: 11 }}>{b.scanners} phones</span></td>
                          <td style={num}>{b.signed_in}</td>
                          <td style={num}>{b.leads}</td>
                          <td style={num}>{b.visits}</td>
                          <td style={num}>{b.spots}</td>
                          <td style={{ ...cell, whiteSpace: "nowrap", color: C.textDim }}>{b.last_scan ? relTime(b.last_scan) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section>
              <h2 style={{ fontSize: 15, margin: "0 0 8px", color: C.text }}>Hotspot areas</h2>
              {data.areas.length === 0 ? <Empty pad={20}>No areas yet: they come from located sign-ins and posters saved with a spot.</Empty> : (
                <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={th}>Area</th><th style={thn}>Scans</th><th style={thn}>Located</th><th style={thn}>Poster spot</th><th style={thn}>Brokers</th></tr></thead>
                    <tbody>
                      {data.areas.map((a) => (
                        <tr key={a.area}>
                          <td style={cell}><b>{a.area}</b>{a.scans >= 2 && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: C.coral }}>HOTSPOT</span>}</td>
                          <td style={num}><b>{a.scans}</b></td>
                          <td style={num}>{a.gps}</td>
                          <td style={num}>{a.poster}</td>
                          <td style={num}>{a.brokers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
