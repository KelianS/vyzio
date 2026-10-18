#!/usr/bin/env bash
# A new formatter compares a business value with string literals.
set -euo pipefail
cat > src/dashboard/src/common/camera/ir_cut_label.ts <<'TS'
import type { IrCutMode } from '../../domain/entities/camera_image_settings.entity'

export function irCutLabel(mode: IrCutMode): string {
  if (mode === 'auto') return 'Automatique'
  return mode === 'on' ? 'Activée' : 'Désactivée'
}
TS
