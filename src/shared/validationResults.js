// ── Measured model-quality results ─────────────────────────────────────────
// These are MEASURED values — produce them by running inside semafori-vision/:
//
//   python validate_counts.py --video <clip> --line-start ... --line-end ...
//   python benchmark_detectors.py --camera <cam> --limit 20
//
// Then fill in the numbers below and set measuredAt to the measurement date.
// While the headline values are null, the "Model quality" card on the
// Analytics page hides itself — nothing fake is ever shown.

export const VALIDATION_RESULTS = {
  measuredAt: null,       // string, e.g. '2026-08-10'
  model: 'YOLOv8n (ONNX Runtime)',
  countPrecision: null,   // 0–1, e.g. 0.94
  countRecall: null,      // 0–1, e.g. 0.90
  countF1: null,          // 0–1, e.g. 0.92
  comparedWith: 'YOLO11n',
  speedup: null,          // number, e.g. 1.8  (× faster than the alternative)
};
