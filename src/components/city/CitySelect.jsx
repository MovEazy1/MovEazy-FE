/**
 * A plain City dropdown for forms that add a flat, building or requirement:
 * pick the city first, and the Area list below shows that city's areas only
 * (useAreas(city), lib/areas.js). Styled by the form it sits in (className /
 * style passed through), so it looks like the Area select beside it.
 */
import { CITIES } from "../../lib/cities";

export default function CitySelect({ value, onChange, className, style, id, disabled, label = "City", allowed }) {
  const list = allowed?.length ? CITIES.filter((c) => allowed.includes(c.name)) : CITIES;
  return (
    <select id={id} className={className} style={style} value={value || ""} disabled={disabled}
      aria-label={label} onChange={(e) => onChange(e.target.value)}>
      {list.map((c) => <option key={c.name} value={c.name}>{c.label}</option>)}
    </select>
  );
}
