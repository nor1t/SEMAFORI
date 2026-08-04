# SEMAFORI Vision — Model Validation Results

> Fill this in after running the validation tooling in `semafori-vision/`:
>
> ```bash
> python validate_counts.py --video <clip.mp4> --line-start X,Y --line-end X,Y
> python benchmark_detectors.py --camera <cam> --limit 20
> ```
>
> After filling the numbers here, also copy the headline values into
> `src/shared/validationResults.js` — the Analytics page displays them.

**Measurement date:** `YYYY-MM-DD`
**Model under test:** YOLOv8n (ONNX Runtime, CPU)
**Pipeline mode:** tracked (32-frame bursts @ 4 fps, ByteTrack + LineZone)

---

## 1. Ground-truth method

Describe how the ground truth was produced:

- Video clip(s) used: `...` (camera, date, duration, conditions — day/night/rain)
- Manual counting method: watched the clip at 0.5× and counted every vehicle
  crossing the calibrated counting line; noted direction (in/out) and class.
- The automated pipeline then processed the same clip with the same line
  coordinates, and totals were compared per camera.

| Camera | Clip duration | Manual count (in/out/total) | Auto count (in/out/total) |
| ------ | ------------- | --------------------------- | ------------------------- |
| c001 Fushë Kosova | | | |
| c002 Aktash | | | |
| c003 Pejton | | | |
| c004 Bregu i Diellit | | | |

## 2. Per-camera precision / recall / F1

From `validate_counts.py` output:

| Camera | Precision | Recall | F1 | Absolute accuracy |
| ------ | --------- | ------ | -- | ----------------- |
| c001 Fushë Kosova | | | | |
| c002 Aktash | | | | |
| c003 Pejton | | | | |
| c004 Bregu i Diellit | | | | |
| **Average** | | | | |

**Notes:** (typical error sources — occlusions at the intersection, night
glare, motorcycles grouping with cars, etc.)

## 3. Detector benchmark — YOLOv8n vs YOLO11n

From `benchmark_detectors.py` output (same frame set, CPU):

| Model | Params | Avg inference / frame | Total detections | Notes |
| ----- | ------ | -------------------- | ---------------- | ----- |
| YOLOv8n (ONNX) | 3.2 M | | | chosen — runs within the 512 MB free-tier budget |
| YOLO11n (ONNX) | ~2.6 M | | | |

**Speedup ratio:** YOLO11n vs YOLOv8n = `…×` (justify the choice either way:
accuracy vs latency vs memory).

## 4. Conclusion

Summarize: is the counting accurate enough for percentile-based load
classification (low/medium/high/congested)? What is the measured F1, and what
does it imply for the reliability of the dashboard's numbers? Any biases
(undercount at night?) and planned mitigations.
