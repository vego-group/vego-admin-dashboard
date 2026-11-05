/**
 * How a vehicle is named on screen: its plate, or its database id when it has
 * no plate. Never an invented label.
 *
 * The Vehicle Control list used to show "Vego #203…-01" and "Vego 2030", the
 * mapper filled a missing plate with "VH-{id}" and a missing model with
 * "VegoMax Pro", and the Fleet table showed "#Vehi-{id}" — none of them on the
 * vehicle or in the API (FA-205). This is the list an operator picks from
 * before cutting an engine, so the name has to be the one on the machine.
 *
 * Render it in a left-to-right span (`<span dir="ltr">`), or through
 * `ltrIsolate()` inside a translated sentence: plates and ids are LTR tokens.
 */
export function vehicleDisplayName(vehicle: { id: string; plateNumber?: string }): string {
  return vehicle.plateNumber?.trim() || `#${vehicle.id}`;
}

/** Does this vehicle match a search across its plate, id, model and driver? */
export function vehicleMatches(
  vehicle: { id: string; plateNumber?: string; model?: string; assignedDriverName?: string; location?: string },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  // Plates are searched with and without their spaces: "ABC 1234" matches "abc1234".
  const compact = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  return [vehicle.plateNumber, vehicle.id, `#${vehicle.id}`, vehicle.model, vehicle.assignedDriverName, vehicle.location]
    .some((field) => !!field && (field.toLowerCase().includes(q) || compact(field).includes(compact(q))));
}
