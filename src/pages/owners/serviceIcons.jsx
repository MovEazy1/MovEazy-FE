/** One icon per service and repair category, so the grid reads at a glance. */
import {
  AirVent, Bug, CircleEllipsis, Droplets, Hammer, Paintbrush, Palette, Sparkles, WashingMachine, Wrench, Zap,
} from "lucide-react";

const BY_KEY = {
  "deep-cleaning": Sparkles, cleaning: Sparkles,
  "ac-service": AirVent, ac: AirVent,
  plumbing: Droplets,
  electrical: Zap,
  painting: Paintbrush,
  "appliance-repair": WashingMachine, appliance: WashingMachine, appliances: WashingMachine,
  carpentry: Hammer,
  "pest-control": Bug,
  designer: Palette,
  repairs: Wrench,
  other: CircleEllipsis,
};

export function ServiceIcon({ id, category, size = 22 }) {
  const Icon = BY_KEY[id] || BY_KEY[category] || Wrench;
  return <Icon size={size} />;
}
