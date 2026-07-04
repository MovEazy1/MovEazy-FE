import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import PageShell from "../components/layout/PageShell";
import {
  getListingPrivateData,
  getInterestsForSellerEmail,
  getVisitsForSellerEmail,
  withdrawListingBySeller,
  republishListingBySeller,
} from "../lib/firestoreStore";
import { db } from "../lib/firebase";
import SmartImage from "../components/SmartImage";
import { collection, getDocs, query, where } from "firebase/firestore";

const BRAND = "#ff3131";

function StatPill({ label, value, color = "#64748b" }) {
  return (
    <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-gray-50 border border-gray-100 min-w-[72px]">
      <span className="text-[18px] font-extrabold" style={{ color }}>{value ?? "—"}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-0.5">{label}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    published: { bg: "#f0fdf4", color: "#16a34a", label: "Live" },
    withdrawn: { bg: "#fef2f2", color: "#dc2626", label: "Withdrawn" },
    draft: { bg: "#fefce8", color: "#b45309", label: "Draft" },
  };
  const s = map[status] || { bg: "#f1f5f9", color: "#475569", label: status || "Unknown" };
  return (
    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function ContactRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="font-semibold text-gray-500 w-24 shrink-0">{label}</span>
      <a href={`tel:${value}`} className="font-bold text-blue-600 hover:underline">{value}</a>
    </div>
  );
}

function ListingCard({ listing, interests, visits, contactClicks, contactLeads, onWithdraw, onRepublish }) {
  const [contact, setContact] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [loadingContact, setLoadingContact] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [acting, setActing] = useState(false);

  const listingInterests = interests.filter(i =>
    i.listingId === listing.id || i.listingSlug === listing.slug
  ).length;
  const listingVisits = visits.filter(v =>
    v.listingId === listing.id || v.listingSlug === listing.slug
  ).length;
  const listingClicks = contactClicks.filter(c => c.propertyId === listing.id).length;
  const listingLeads = contactLeads.filter(l => l.propertyId === listing.id);

  const loadContact = async () => {
    if (contact) { setShowContact(v => !v); return; }
    setLoadingContact(true);
    try {
      const data = await getListingPrivateData(listing.id);
      setContact(data || {});
      setShowContact(true);
    } catch {
      setContact({});
      setShowContact(true);
    } finally {
      setLoadingContact(false);
    }
  };

  const handleWithdraw = async () => {
    if (!confirm("Withdraw this listing from public view?")) return;
    setActing(true);
    try { await onWithdraw(listing.id); setActionMsg("Withdrawn."); }
    catch { setActionMsg("Failed. Try again."); }
    finally { setActing(false); }
  };

  const handleRepublish = async () => {
    setActing(true);
    try { await onRepublish(listing.id); setActionMsg("Live again!"); }
    catch { setActionMsg("Failed. Try again."); }
    finally { setActing(false); }
  };

  const coverImg = listing.cover_image_url || listing.images?.[0] || listing.coverImage;
  const rent = listing.monthly_rent || listing.price;
  const area = listing.area || listing.address;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Cover image */}
      <div className="relative h-44 bg-gray-100 shrink-0">
        {coverImg
            ? <SmartImage src={coverImg} alt={listing.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-gray-300 text-[13px] font-semibold">No photo</div>
          }
        <div className="absolute top-3 left-3">
          <StatusBadge status={listing.marketStatus || listing.status} />
        </div>
        {listing.listing_type === "room" && (
          <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Room</div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="text-[15px] font-extrabold text-gray-900 leading-snug line-clamp-1">{listing.title || listing.display_title || "Untitled"}</h3>
          {area && <p className="text-[12px] text-gray-500 mt-0.5">{area}</p>}
        </div>

        <div className="flex gap-2 flex-wrap">
          <StatPill label="Rent" value={rent ? `₹${Number(rent).toLocaleString("en-IN")}` : "—"} color={BRAND} />
          <StatPill label="Views" value={listing.view_count ?? 0} />
          <StatPill label="Interests" value={listingInterests} color="#7c3aed" />
          <StatPill label="Visits" value={listingVisits} color="#6366f1" />
          <StatPill label="Contacts" value={listingClicks} color="#0891b2" />
          <StatPill label="Leads" value={listingLeads.length} color="#16a34a" />
        </div>

        <div className="flex items-center gap-2 text-[12px] text-gray-400">
          <span>{listing.bedroom_count || listing.bhk || "—"} BHK</span>
          <span>·</span>
          <span>{listing.is_furnished ? "Furnished" : "Unfurnished"}</span>
          {listing.gender_preference && listing.gender_preference !== "any" && (
            <><span>·</span><span className="capitalize">{listing.gender_preference === "female" ? "Girls Only" : "Boys Only"}</span></>
          )}
        </div>

        {/* Contact section */}
        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={loadContact}
            disabled={loadingContact}
            className="text-[12px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            style={{ color: showContact ? "#64748b" : BRAND }}
          >
            {loadingContact ? "Loading…" : showContact ? "Hide Contact" : "Show Contact Info"}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: showContact ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showContact && contact && (
            <div className="mt-2.5 flex flex-col gap-1.5 bg-gray-50 rounded-xl p-3">
              <ContactRow label="Owner Phone" value={contact.ownerPhonePrivate || contact.ownerPhone} />
              <ContactRow label="Agent Phone" value={contact.agentPhonePrivate || contact.agentPhone} />
              <ContactRow label="Owner Email" value={contact.ownerEmail} />
              {!contact.ownerPhonePrivate && !contact.agentPhonePrivate && !contact.ownerEmail && (
                <p className="text-[12px] text-gray-400">No contact info saved for this listing.</p>
              )}
            </div>
          )}
        </div>

        {/* Leads from Contact Lister form */}
        {listingLeads.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">People who contacted ({listingLeads.length})</p>
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
              {listingLeads.map((lead, i) => (
                <div key={lead.id || i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-[12px] font-bold text-gray-900">{lead.name || "—"}</p>
                    <p className="text-[11px] text-gray-500">{lead.email || ""}</p>
                  </div>
                  <a href={`tel:${lead.phone}`} className="text-[12px] font-bold text-blue-600 hover:underline shrink-0">{lead.phone || "—"}</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-1">
          {(listing.marketStatus === "published" || listing.status === "published") ? (
            <button type="button" onClick={handleWithdraw} disabled={acting}
              className="flex-1 py-2 rounded-xl text-[12px] font-bold border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
              Withdraw
            </button>
          ) : (
            <button type="button" onClick={handleRepublish} disabled={acting}
              className="flex-1 py-2 rounded-xl text-[12px] font-bold border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50">
              Re-publish
            </button>
          )}
          <a
            href={`/new-listings?listing=${listing.slug || listing.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 rounded-xl text-[12px] font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-center"
          >
            View Live
          </a>
        </div>

        {actionMsg && <p className="text-[12px] font-semibold" style={{ color: actionMsg.includes("Fail") ? "#dc2626" : "#16a34a" }}>{actionMsg}</p>}
      </div>
    </div>
  );
}

export default function ListingDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [interests, setInterests] = useState([]);
  const [visits, setVisits] = useState([]);
  const [contactClicks, setContactClicks] = useState([]);
  const [contactLeads, setContactLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | published | withdrawn

  useEffect(() => {
    if (!user) { navigate("/login?next=/my-listings"); return; }
    async function load() {
      try {
        const email = user.email?.toLowerCase().trim();
        const col = collection(db, "listings");
        const [bySellerEmail, byOwnerEmail, ints, vis, clicksSnap, leadsSnap] = await Promise.all([
          getDocs(query(col, where("sellerEmail", "==", email))),
          getDocs(query(col, where("owner_email", "==", email))),
          getInterestsForSellerEmail(email),
          getVisitsForSellerEmail(email),
          getDocs(query(collection(db, "listingContactClicks"), where("ownerEmail", "==", email))),
          getDocs(query(collection(db, "listing_leads"), where("ownerEmail", "==", email))),
        ]);
        setContactClicks(clicksSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setContactLeads(leadsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        // Merge, dedup by id
        const seen = new Set();
        const merged = [];
        [...bySellerEmail.docs, ...byOwnerEmail.docs].forEach(d => {
          if (!seen.has(d.id)) { seen.add(d.id); merged.push({ id: d.id, ...d.data() }); }
        });
        const ls = merged;
        setListings(ls);
        setInterests(ints);
        setVisits(vis);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, navigate]);

  const handleWithdraw = async (id) => {
    await withdrawListingBySeller(id);
    setListings(p => p.map(l => l.id === id ? { ...l, marketStatus: "withdrawn" } : l));
  };

  const handleRepublish = async (id) => {
    await republishListingBySeller(id);
    setListings(p => p.map(l => l.id === id ? { ...l, marketStatus: "published" } : l));
  };

  const filtered = listings.filter(l => {
    if (filter === "all") return true;
    if (filter === "published") return l.marketStatus === "published";
    if (filter === "withdrawn") return l.marketStatus !== "published";
    return true;
  });

  const totalViews = listings.reduce((s, l) => s + (l.view_count || 0), 0);

  if (!user) return null;

  return (
    <PageShell variant="marketing" overlayOnly className="antialiased" style={{ background: "#f5f0eb" }}>
      <Navbar variant="marketing" />

      <main className="max-w-6xl mx-auto px-4 pb-16 pt-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[28px] font-extrabold text-gray-900 leading-tight">My Listings</h1>
            <p className="text-[13px] text-gray-500 mt-1">Manage your properties and see contact info</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/list-my-flat")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[13px] font-bold text-white shrink-0"
            style={{ background: `linear-gradient(135deg,${BRAND},#ef4444)` }}
          >
            + Add New Listing
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          {[
            { label: "Total Listings", value: listings.length, color: "#0f172a" },
            { label: "Live", value: listings.filter(l => l.marketStatus === "published").length, color: "#16a34a" },
            { label: "Total Views", value: totalViews, color: "#7c3aed" },
            { label: "Contact Clicks", value: contactClicks.length, color: "#0891b2" },
            { label: "Total Leads", value: contactLeads.length, color: BRAND },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4 text-center shadow-sm">
              <div className="text-[28px] font-extrabold" style={{ color }}>{value}</div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {[["all", "All"], ["published", "Live"], ["withdrawn", "Withdrawn"]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)}
              className="px-4 py-2 rounded-full text-[12px] font-bold transition-all"
              style={{
                background: filter === id ? "#0f172a" : "white",
                color: filter === id ? "white" : "#64748b",
                border: filter === id ? "1px solid #0f172a" : "1px solid #e2e8f0",
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-[14px] font-semibold">Loading your listings…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-[40px] mb-4">🏠</div>
            <p className="text-[16px] font-bold text-gray-700 mb-2">
              {listings.length === 0 ? "No listings yet" : "No listings match this filter"}
            </p>
            <p className="text-[13px] text-gray-400 mb-6">
              {listings.length === 0 ? "Add your first property to get started." : "Try switching the filter above."}
            </p>
            {listings.length === 0 && (
              <button type="button" onClick={() => navigate("/list-my-flat")}
                className="px-6 py-3 rounded-2xl text-[14px] font-bold text-white"
                style={{ background: `linear-gradient(135deg,${BRAND},#ef4444)` }}>
                List My Flat
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(listing => (
              <ListingCard
                key={listing.id}
                listing={listing}
                interests={interests}
                visits={visits}
                contactClicks={contactClicks}
                contactLeads={contactLeads}
                onWithdraw={handleWithdraw}
                onRepublish={handleRepublish}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </PageShell>
  );
}
