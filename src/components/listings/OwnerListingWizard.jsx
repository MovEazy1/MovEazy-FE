import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AREA_NAMES_SORTED } from "../../data/listingsData";
import {
  BHK_OPTIONS,
  DRAFT_STORAGE_KEY,
  FLAT_AMENITIES,
  FURNISHING_OPTIONS,
  GENDER_OPTIONS,
  HOUSE_RULES,
  WIZARD_STEPS,
  coordsForArea,
  ownerWizardDefaults,
  titleSuggestions,
  validateStep,
  wizardToListingForm,
} from "../../lib/ownerListingWizard";
import "../../styles/list-my-home.css";

function FieldLabel({ children, required }) {
  return (
    <label className="lmh-label">
      {children}
      {required ? <span className="req"> *</span> : null}
    </label>
  );
}

function StepEssentials({ wizard, setWizard, showErrors }) {
  const errs = showErrors ? validateStep(0, wizard) : [];
  const errSet = new Set(errs.map((e) => e.toLowerCase()));

  return (
    <>
      <h2 className="lmh-section-title">What are you listing?</h2>
      <div className="lmh-listing-type">
        <button
          type="button"
          className={`lmh-type-card ${wizard.listingKind === "vacant_room" ? "is-selected" : ""}`}
          onClick={() => setWizard((p) => ({ ...p, listingKind: "vacant_room" }))}
        >
          <input type="radio" readOnly checked={wizard.listingKind === "vacant_room"} />
          <div>
            <div className="lmh-type-title">🚪 Vacant Room</div>
            <div className="lmh-type-hint">Looking for a flatmate</div>
          </div>
        </button>
        <button
          type="button"
          className={`lmh-type-card ${wizard.listingKind === "entire_flat" ? "is-selected" : ""}`}
          onClick={() => setWizard((p) => ({ ...p, listingKind: "entire_flat" }))}
        >
          <input type="radio" readOnly checked={wizard.listingKind === "entire_flat"} />
          <div>
            <div className="lmh-type-title">🏠 Entire Flat</div>
            <div className="lmh-type-hint">Rent out the whole property</div>
          </div>
        </button>
      </div>

      <div className="lmh-grid-2">
        <div>
          <FieldLabel required>City</FieldLabel>
          <input
            className="lmh-input"
            value={wizard.city}
            onChange={(e) => setWizard((p) => ({ ...p, city: e.target.value }))}
          />
        </div>
        <div>
          <FieldLabel required>Area</FieldLabel>
          <input
            className="lmh-input"
            list="lmh-area-list"
            placeholder="Koramangala, BTM Layout"
            value={wizard.area}
            onChange={(e) => setWizard((p) => ({ ...p, area: e.target.value }))}
          />
          <datalist id="lmh-area-list">
            {AREA_NAMES_SORTED.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {showErrors && errSet.has("area") ? (
            <p className="lmh-review-missing">Please select from dropdown</p>
          ) : null}
        </div>
        <div className="lmh-grid-2" style={{ gridColumn: "1 / -1" }}>
          <div>
            <FieldLabel>Precise / Nearby Address</FieldLabel>
            <input
              className="lmh-input"
              placeholder="e.g., Near Forum Mall, 100 Feet Road"
              value={wizard.nearbyAddress}
              onChange={(e) => setWizard((p) => ({ ...p, nearbyAddress: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel required>
              Monthly Rent (₹) <span title="Rent per month">ⓘ</span>
            </FieldLabel>
            <input
              className="lmh-input"
              type="number"
              min={0}
              placeholder="25,000"
              value={wizard.monthlyRent}
              onChange={(e) => setWizard((p) => ({ ...p, monthlyRent: e.target.value }))}
            />
            {showErrors && errs.some((e) => e.includes("Rent")) ? (
              <p className="lmh-review-missing">Please fill</p>
            ) : null}
          </div>
        </div>
        <div>
          <FieldLabel>Security Deposit</FieldLabel>
          <input
            className="lmh-input"
            placeholder="50,000"
            value={wizard.securityDeposit}
            onChange={(e) => setWizard((p) => ({ ...p, securityDeposit: e.target.value }))}
          />
        </div>
        <div>
          <FieldLabel required>Available From</FieldLabel>
          <input
            className="lmh-input"
            type="date"
            value={wizard.availableFrom}
            onChange={(e) => setWizard((p) => ({ ...p, availableFrom: e.target.value }))}
          />
          {showErrors && errs.some((e) => e.includes("Available")) ? (
            <p className="lmh-review-missing">Please fill</p>
          ) : null}
        </div>
      </div>

      <div className="lmh-agent-card">
        <div className="lmh-agent-title">💼 Are you an Agent/Broker?</div>
        <div className="lmh-radio-row">
          <label className="lmh-radio-opt">
            <input
              type="radio"
              checked={!wizard.isAgentBroker}
              onChange={() => setWizard((p) => ({ ...p, isAgentBroker: false }))}
            />
            No, I&apos;m the owner/existing tenant
          </label>
          <label className="lmh-radio-opt">
            <input
              type="radio"
              checked={wizard.isAgentBroker}
              onChange={() => setWizard((p) => ({ ...p, isAgentBroker: true }))}
            />
            Yes, I&apos;m an agent/broker
          </label>
        </div>
        <p className="lmh-tip">💡 Being transparent builds trust with renters</p>
      </div>

      <div>
        <FieldLabel required>Your flat size</FieldLabel>
        <div className="lmh-chip-row">
          {BHK_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`lmh-chip ${wizard.bhk === opt ? "is-selected" : ""}`}
              onClick={() => setWizard((p) => ({ ...p, bhk: opt }))}
            >
              {opt}
            </button>
          ))}
        </div>
        {showErrors && errs.some((e) => e.includes("flat size")) ? (
          <p className="lmh-review-missing">Please select</p>
        ) : null}
      </div>
    </>
  );
}

function StepDescribe({ wizard, setWizard, showErrors }) {
  const toggleAmenity = (id) => {
    setWizard((p) => {
      const set = new Set(p.amenitiesSelected);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...p, amenitiesSelected: [...set] };
    });
  };
  const toggleRule = (id) => {
    setWizard((p) => {
      const set = new Set(p.houseRulesSelected);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...p, houseRulesSelected: [...set] };
    });
  };
  const suggestions = titleSuggestions(wizard.area);

  return (
    <>
      <h2 className="lmh-section-title">Amenities</h2>
      <div className="lmh-subsection">
        <div className="lmh-subsection-label">Furnishing Status</div>
        <div className="lmh-pill-row">
          {FURNISHING_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`lmh-pill ${wizard.furnishing === opt.id ? "is-selected" : ""}`}
              onClick={() => setWizard((p) => ({ ...p, furnishing: opt.id }))}
            >
              <span>{opt.icon}</span> {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lmh-subsection">
        <div className="lmh-subsection-label">Flat Amenities</div>
        <div className="lmh-amenity-grid">
          {FLAT_AMENITIES.map((item) => (
            <label
              key={item.id}
              className={`lmh-amenity ${wizard.amenitiesSelected.includes(item.id) ? "is-selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={wizard.amenitiesSelected.includes(item.id)}
                onChange={() => toggleAmenity(item.id)}
              />
              <span>{item.icon}</span> {item.id}
            </label>
          ))}
        </div>
      </div>

      <h2 className="lmh-section-title" style={{ marginTop: "1.5rem" }}>
        House Rules &amp; Preferences
      </h2>
      <div className="lmh-subsection">
        <div className="lmh-subsection-label">Gender Preference</div>
        <div className="lmh-pill-row">
          {GENDER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`lmh-pill ${wizard.genderPreference === opt.id ? "is-selected" : ""}`}
              onClick={() => setWizard((p) => ({ ...p, genderPreference: opt.id }))}
            >
              <span>{opt.icon}</span> {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lmh-subsection">
        <div className="lmh-subsection-label">House Rules</div>
        <div className="lmh-amenity-grid">
          {HOUSE_RULES.map((item) => (
            <label
              key={item.id}
              className={`lmh-amenity ${wizard.houseRulesSelected.includes(item.id) ? "is-selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={wizard.houseRulesSelected.includes(item.id)}
                onChange={() => toggleRule(item.id)}
              />
              <span>{item.icon}</span> {item.id}
            </label>
          ))}
        </div>
      </div>

      <h2 className="lmh-section-title" style={{ marginTop: "1.5rem" }}>
        Listing Details
      </h2>
      <div className="lmh-subsection">
        <FieldLabel required>Property Name</FieldLabel>
        <input
          className="lmh-input"
          placeholder="Give your property a fun name"
          value={wizard.propertyName}
          onChange={(e) => setWizard((p) => ({ ...p, propertyName: e.target.value }))}
        />
        {showErrors && !wizard.propertyName?.trim() ? (
          <p className="lmh-review-missing">Please fill</p>
        ) : null}
        <div className="lmh-suggestions">
          Suggestions:{" "}
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="lmh-suggestion-chip"
              onClick={() => setWizard((p) => ({ ...p, propertyName: s }))}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Description</FieldLabel>
        <textarea
          className="lmh-textarea"
          placeholder="Tell us about your space, the neighborhood, or what makes it special..."
          value={wizard.description}
          onChange={(e) => setWizard((p) => ({ ...p, description: e.target.value }))}
        />
      </div>
    </>
  );
}

function StepPublish({ wizard, setWizard, photoFiles, setPhotoFiles, showErrors }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const previewUrls = useMemo(
    () => (photoFiles || []).map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [photoFiles]
  );

  useEffect(() => {
    return () => previewUrls.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previewUrls]);

  const appendFiles = (incoming) => {
    const valid = Array.from(incoming || []).filter(Boolean);
    if (!valid.length) return;
    setPhotoFiles((prev) => [...(prev || []), ...valid].slice(0, 20));
  };

  const listingKindLabel = wizard.listingKind === "vacant_room" ? "Vacant Room" : "Entire Flat";
  const missing = showErrors ? validateStep(2, wizard) : [];

  return (
    <>
      <h2 className="lmh-section-title">Photos</h2>
      <div
        className={`lmh-upload-zone ${isDragging ? "is-dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          appendFiles(e.dataTransfer?.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => appendFiles(e.target.files)}
        />
        <div className="lmh-upload-icon">☁️</div>
        <div style={{ fontWeight: 700, color: "#374151" }}>Drop photos here or click to browse</div>
        <div className="lmh-upload-hint">Up to 20 images, 30MB each</div>
      </div>
      <p className="lmh-photo-tip">💡 Photos are optional but highly recommended</p>

      {previewUrls.length > 0 ? (
        <div className="lmh-photo-previews">
          {previewUrls.map(({ url, file }) => (
            <img key={url} src={url} alt={file.name} />
          ))}
        </div>
      ) : null}

      <h2 className="lmh-section-title" style={{ marginTop: "1.5rem" }}>
        Review Your Listing
      </h2>
      <div className="lmh-review-card">
        <div className="lmh-review-row">
          <span className="lmh-review-label">Property Title *</span>
          <span>{wizard.propertyName || <span className="lmh-review-missing">Please fill</span>}</span>
        </div>
        <div className="lmh-review-row">
          <span>📍 Location *</span>
          <span>
            {wizard.area ? `${wizard.area}, ${wizard.city}` : <span className="lmh-review-missing">Please select from dropdown</span>}
          </span>
        </div>
        <div className="lmh-review-row">
          <span>🏠 BHK *</span>
          <span>{wizard.bhk || <span className="lmh-review-missing">Please fill</span>}</span>
          <span className="lmh-review-amenity">🏠 {listingKindLabel}</span>
        </div>
        <div className="lmh-grid-2" style={{ marginTop: "0.5rem" }}>
          <div style={{ background: "#f9fafb", padding: "0.65rem", borderRadius: 10 }}>
            <div className="lmh-review-label">Monthly Rent *</div>
            <div>
              {wizard.monthlyRent ? `₹${Number(wizard.monthlyRent).toLocaleString("en-IN")}` : <span className="lmh-review-missing">Please fill</span>}
            </div>
          </div>
          <div style={{ background: "#f9fafb", padding: "0.65rem", borderRadius: 10 }}>
            <div className="lmh-review-label">Available From *</div>
            <div>{wizard.availableFrom || <span className="lmh-review-missing">Please fill</span>}</div>
          </div>
        </div>
        {wizard.amenitiesSelected.length > 0 || wizard.furnishing ? (
          <div style={{ marginTop: "0.75rem" }}>
            <div className="lmh-review-label">Amenities</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.35rem" }}>
              <span className="lmh-review-amenity">🏠 {wizard.furnishing}</span>
              {wizard.amenitiesSelected.slice(0, 6).map((a) => (
                <span key={a} className="lmh-review-amenity">
                  {a}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <p className="lmh-ps-note">
          <strong>PS:</strong> You can edit or add more details like additional charges, maid, etc after posting the property.
        </p>
      </div>

      {missing.length > 0 && showErrors ? (
        <div className="lmh-error-box">
          <strong>⚠ Please fill the following mandatory fields:</strong>
          <ul>
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="lmh-terms">
        <input
          type="checkbox"
          checked={wizard.termsAccepted}
          onChange={(e) => setWizard((p) => ({ ...p, termsAccepted: e.target.checked }))}
        />
        <span>
          <strong>I accept the terms and conditions</strong>
          <br />
          <span style={{ color: "#6b7280", fontSize: "0.8rem" }}>
            By posting this listing, you agree to our terms of service and privacy policy.
          </span>
        </span>
      </label>
    </>
  );
}

export default function OwnerListingWizard({
  user,
  formPinPosition,
  setFormPinPosition,
  photoFiles,
  setPhotoFiles,
  onSubmit,
  saving,
  msg,
  msgKind,
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [wizard, setWizard] = useState(() => ownerWizardDefaults(user));
  const [showErrors, setShowErrors] = useState(false);
  const [savedLabel, setSavedLabel] = useState("");
  const saveTimerRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setWizard((p) => ({ ...p, ...parsed, sellerEmail: user?.email || p.sellerEmail }));
      }
    } catch {
      /* ignore */
    }
  }, [user?.email]);

  const persistDraft = useCallback((data) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
        setSavedLabel("Saved just now");
      } catch {
        /* ignore */
      }
    }, 400);
  }, []);

  useEffect(() => {
    persistDraft(wizard);
  }, [wizard, persistDraft]);

  useEffect(() => {
    if (!wizard.area) return;
    const { lat, lng } = coordsForArea(wizard.area);
    setFormPinPosition([lat, lng]);
    setWizard((p) => ({ ...p, lat, lng }));
  }, [wizard.area, setFormPinPosition]);

  const progress = WIZARD_STEPS[step].progress;

  const goNext = () => {
    const errors = validateStep(step, wizard);
    if (errors.length) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (step < WIZARD_STEPS.length - 1) setStep((s) => s + 1);
  };

  const goBack = () => {
    setShowErrors(false);
    if (step > 0) setStep((s) => s - 1);
    else navigate("/");
  };

  const handleClear = () => {
    if (!window.confirm("Clear all fields and start over?")) return;
    const fresh = ownerWizardDefaults(user);
    setWizard(fresh);
    setPhotoFiles([]);
    setStep(0);
    setShowErrors(false);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setSavedLabel("");
  };

  const handlePublish = (e) => {
    e.preventDefault();
    const errors = validateStep(2, wizard);
    if (errors.length) {
      setShowErrors(true);
      return;
    }
    const listingForm = wizardToListingForm(wizard, formPinPosition);
    onSubmit(e, listingForm);
  };

  return (
    <div className="lmh-page">
      <div className="lmh-shell">
        <div className="lmh-header-card">
          <div className="lmh-header-row">
            <h1 className="lmh-title">Post your Property</h1>
            <div className="lmh-header-actions">
              <button type="button" className="lmh-clear-btn" onClick={handleClear}>
                Clear All
              </button>
              {savedLabel ? <span className="lmh-saved">✓ {savedLabel}</span> : null}
            </div>
          </div>
          <div className="lmh-progress-label">Progress: {progress}%</div>
          <div className="lmh-progress-track">
            <div className="lmh-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="lmh-step-bar" role="tablist">
          {WIZARD_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={step === i}
              className={`lmh-step-tab ${step === i ? "is-active" : ""}`}
              onClick={() => {
                if (i < step) {
                  setStep(i);
                  setShowErrors(false);
                } else if (i === step + 1) goNext();
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <form className="lmh-form-card" onSubmit={step === 2 ? handlePublish : (e) => e.preventDefault()}>
          {step === 0 ? <StepEssentials wizard={wizard} setWizard={setWizard} showErrors={showErrors} /> : null}
          {step === 1 ? <StepDescribe wizard={wizard} setWizard={setWizard} showErrors={showErrors} /> : null}
          {step === 2 ? (
            <StepPublish
              wizard={wizard}
              setWizard={setWizard}
              photoFiles={photoFiles}
              setPhotoFiles={setPhotoFiles}
              showErrors={showErrors}
            />
          ) : null}

          {msg ? <div className={`lmh-msg ${msgKind === "err" ? "err" : "ok"}`}>{msg}</div> : null}

          <div className="lmh-actions">
            <button type="button" className="lmh-btn-cancel" onClick={goBack}>
              {step === 0 ? "Cancel" : "Back"}
            </button>
            {step < 2 ? (
              <button type="button" className="lmh-btn-proceed" onClick={goNext}>
                Proceed
              </button>
            ) : (
              <button type="submit" className="lmh-btn-proceed" disabled={saving}>
                {saving ? "Publishing…" : "Publish listing"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
