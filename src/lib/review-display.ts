export function shouldShowSequenceDiagram(sequenceDiagram: string | null): boolean {
  if (!sequenceDiagram) return false;

  const hasExternalSystem = ["GitHub", "Database", "VectorDB"].some((participant) =>
    sequenceDiagram.includes(`participant ${participant}`)
  );
  const hasConcreteFileStep = /\.tsx?:|\.ts\b|\.tsx\b/.test(sequenceDiagram);

  return hasExternalSystem || hasConcreteFileStep;
}
