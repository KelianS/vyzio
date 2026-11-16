import {
  Bike,
  Bird,
  Car,
  Cat,
  Dog,
  Motorbike,
  PawPrint,
  PersonStanding,
  ScanEye,
  ScanFace,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../ui/utils'

/** The kinds of detection the engine reports, the ones a clip can be recognised by at a glance. */
const DETECTION_KINDS = [
  'person',
  'face',
  'car',
  'truck',
  'motorcycle',
  'bicycle',
  'dog',
  'cat',
  'bird',
  'deer',
] as const
type DetectionKind = (typeof DETECTION_KINDS)[number]

const KIND_ICON: Record<DetectionKind, LucideIcon> = {
  person: PersonStanding,
  face: ScanFace,
  car: Car,
  truck: Truck,
  motorcycle: Motorbike,
  bicycle: Bike,
  dog: Dog,
  cat: Cat,
  bird: Bird,
  deer: PawPrint,
}

function isDetectionKind(label: string): label is DetectionKind {
  return (DETECTION_KINDS as readonly string[]).includes(label)
}

/** A detection's type in a small neutral circle, before its name (DESIGN SYSTEM § Component foundation). */
export function DetectionTypeIcon({ label, className }: { label: string; className?: string }) {
  const kind = label.toLowerCase()
  // A type the table does not know shows a generic one.
  const Icon = isDetectionKind(kind) ? KIND_ICON[kind] : ScanEye
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full bg-icon-circle text-ink-muted',
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}
