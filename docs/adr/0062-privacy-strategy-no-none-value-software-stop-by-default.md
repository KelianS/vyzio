# ADR-62: Privacy strategy: no "none" value, software stop by default

> Status: Accepted
>
> Amends [ADR-24](0024-protocol-layer-separated-from-capability-layer-onvifclient-supportedprotocol-privacystrategy.md)
> on its decision 3 (the `PrivacyStrategy` enum) and on its consequence that `PrivacyStrategy.None`
> is an explicit value, and
> [ADR-21](0021-ptz-parking-and-a-generic-onvif-adapter-a-layered-privacy-mode-strategy.md) on its
> update note that spells out the same enum.

## Context

ADR-24 gave `PrivacyStrategy` four values, `None` among them, so that a camera without a configured
strategy would not fall silently onto `SoftwareBlur`. The camera entity defaults to `SoftwareBlur`
all the same, and `None` never meant "nothing happens": privacy mode always stops Vyzio's recording,
detection and notifications ([SPECS](../SPECS.md) 9.2), whatever the strategy. `None` asked nothing
of the camera, exactly like `SoftwareBlur`, so the privacy screen offered two choices with the same
effect, one of them named as if privacy did nothing.

## Decision

**`PrivacyStrategy` has three values: `SoftwareBlur`, `PtzParking`, `Hardware`.** `SoftwareBlur`
comes first, so it is both the enum's default and the entity's. The API refuses `none` like any
unknown value, and its error names the three valid ones. A strategy says what the camera does **on
top of** the software stop, which always happens ([SPECS](../SPECS.md) 9.3).

## Options rejected

- **Keep `None` as an explicit value.** ADR-24's reason was to tell "not configured" apart from
  "software stop". Rejected: the two behave the same, so the difference can be seen only in the
  settings list, where it suggests a privacy mode that stops nothing (principle 4).
- **Give `None` a real meaning (privacy mode leaves the camera recording).** Rejected: it
  contradicts SPECS 9.2, which forbids any recording, detection or notification while privacy mode is on.

## Consequences

- The column keeps storing the name as text, so the EF model does not change and no migration is
  needed. A row still holding `none` no longer reads. On the single instance there is no data
  migration: such a camera is reset before deploying.
- The privacy screen lists three strategies, and a new camera starts on the software stop.
