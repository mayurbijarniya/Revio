export function shouldShowSequenceDiagram(sequenceDiagram: string | null): boolean {
  if (!sequenceDiagram) return false;

  // Diagrams are generated from real cross-file calls; show any that has at least one call step
  return /->>/.test(sequenceDiagram);
}
