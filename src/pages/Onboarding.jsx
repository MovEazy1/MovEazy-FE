import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, Timestamp, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { reportClientError } from "../lib/clientLog";
import logoSvg from "../assets/logo/moveasy.svg";

const FLAT_TYPES = ["1BHK", "2BHK", "3BHK"];

const OFFICE_LOCATIONS = [
  "HSR",
  "Koramangala",
  "Bellandur",
  "Kadubeesanahalli",
  "Sarjapur Road",
  "Indiranagar",
  "Ashok Nagar",
  "Marathahalli",
  "Whitefield",
  "Brookfield",
  "Hoodi",
  "Mahadevapura",
  "Others",
];

export default function Onboarding() {
  const { user, refreshRole } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [flatTypes, setFlatTypes] = useState([]);
  const [officeLocation, setOfficeLocation] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const displayName = name || user?.displayName || "";

  // Redirect if already onboarded
  useEffect(() => {
    if (user?.profileComplete) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
    }
  }, [user, navigate]);

  const toggleFlatType = (type) => {
    setFlatTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const isPhoneValid = /^\d{10}$/.test(phone);

  const validate = () => {
    const errs = {};
    if (!displayName.trim()) errs.name = "Name is required";
    if (!isPhoneValid) errs.phone = "Enter a valid 10-digit phone number";
    if (flatTypes.length === 0)
      errs.flatTypes = "Select at least one flat type";
    if (!officeLocation) errs.officeLocation = "Select your office location";
    if (!moveInDate) errs.moveInDate = "Select your move-in date";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      if (!user?.uid) {
        setErrors({ submit: "Session expired. Please sign in again." });
        setLoading(false);
        navigate("/login", { replace: true });
        return;
      }

      const uid = user.uid;
      const email = (user.email || "").toLowerCase().trim();
      const phoneE164 = `+91${phone}`;

      const writes = [
        setDoc(
          doc(db, "userProfiles", uid),
          {
            uid,
            email,
            name: displayName.trim(),
            phone: phoneE164,
            customerFlatTypes: flatTypes,
            customerOfficeLocation: officeLocation,
            customerMoveInDate: Timestamp.fromDate(new Date(moveInDate)),
            profileComplete: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
      ];

      const roleSnap = await getDoc(doc(db, "userRoles", uid));
      if (!roleSnap.exists()) {
        writes.push(
          setDoc(
            doc(db, "userRoles", uid),
            { uid, email, role: "customer", updatedAt: serverTimestamp() },
            { merge: true }
          )
        );
      }

      const emailRoleSnap = await getDoc(doc(db, "emailRoles", email));
      if (!emailRoleSnap.exists()) {
        writes.push(
          setDoc(
            doc(db, "emailRoles", email),
            { email, role: "customer", updatedAt: serverTimestamp() },
            { merge: true }
          )
        );
      }

      await Promise.all(writes);

      refreshRole();
      navigate("/", { replace: true });
    } catch (err) {
      reportClientError("onboarding_save", err);
      const code = err?.code || "";
      let submit =
        "Failed to save. Please try again.";
      if (code === "permission-denied") {
        submit =
          "Firestore blocked this save (permission denied). Sign in with Google on this app, then ask the project owner to: (1) add your App Check debug token for localhost, or (2) add your email to VITE_ADMIN_EMAILS + bootstrapAdmins in Firebase.";
      }
      setErrors({ submit });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <a href="/" className="inline-block">
            <img
              src={logoSvg}
              alt="MovEASY"
              className="h-10 mx-auto mb-4"
            />
          </a>
          <h1 className="text-2xl font-bold text-gray-900">
            Complete Your Profile
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Tell us a bit about your move so we can help you better
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EF4444]/20 focus:border-[#EF4444] transition-colors ${
                  errors.name ? "border-red-400" : "border-gray-300"
                }`}
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name}</p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone Number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm font-medium">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="Enter 10-digit number"
                  className={`flex-1 px-4 py-3 border rounded-r-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EF4444]/20 focus:border-[#EF4444] transition-colors ${
                    errors.phone ? "border-red-400" : "border-gray-300"
                  }`}
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
              )}
            </div>

            {/* Flat Type — multi-select checkboxes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Flat Type
                <span className="text-gray-400 font-normal ml-1">
                  (select all that apply)
                </span>
              </label>
              <div className="flex gap-3">
                {FLAT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleFlatType(type)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${
                      flatTypes.includes(type)
                        ? "border-[#EF4444] bg-[#EF4444]/5 text-[#EF4444]"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              {errors.flatTypes && (
                <p className="text-xs text-red-500 mt-1">{errors.flatTypes}</p>
              )}
            </div>

            {/* Office Location — dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Office Location
              </label>
              <select
                value={officeLocation}
                onChange={(e) => setOfficeLocation(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EF4444]/20 focus:border-[#EF4444] transition-colors appearance-none bg-white ${
                  errors.officeLocation ? "border-red-400" : "border-gray-300"
                } ${!officeLocation ? "text-gray-400" : "text-gray-900"}`}
              >
                <option value="" disabled>
                  Select your office area
                </option>
                {OFFICE_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              {errors.officeLocation && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.officeLocation}
                </p>
              )}
            </div>

            {/* Move-in Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Move-in Date
              </label>
              <input
                type="date"
                value={moveInDate}
                onChange={(e) => setMoveInDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EF4444]/20 focus:border-[#EF4444] transition-colors ${
                  errors.moveInDate ? "border-red-400" : "border-gray-300"
                } ${!moveInDate ? "text-gray-400" : "text-gray-900"}`}
              />
              {errors.moveInDate && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.moveInDate}
                </p>
              )}
            </div>

            {/* Submit error */}
            {errors.submit && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {errors.submit}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-semibold text-white bg-[#EF4444] rounded-xl hover:bg-[#DC2626] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                "Complete Setup"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
