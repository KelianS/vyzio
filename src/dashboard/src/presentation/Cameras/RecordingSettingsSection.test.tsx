import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordingSettingsSection } from './RecordingSettingsSection'
import type { RecordingSettings } from '../../domain/entities/RecordingSettings'
import type { GetRecordingSettings } from '../../domain/usecases/GetRecordingSettings'
import type { SaveRecordingSettings } from '../../domain/usecases/SaveRecordingSettings'

// Everything still on the values Vyzio ships with.
const AS_SHIPPED: RecordingSettings = {
  continuous: { days: 0, default: 0 },
  motion: { days: 7, default: 7 },
  eventClip: { days: 14, default: 14 },
  maxDays: 365,
}

function renderSection(settings: RecordingSettings = AS_SHIPPED) {
  const save = { execute: vi.fn().mockResolvedValue(settings) } as unknown as SaveRecordingSettings
  render(
    <RecordingSettingsSection
      getRecordingSettings={
        { execute: vi.fn().mockResolvedValue(settings) } as unknown as GetRecordingSettings
      }
      saveRecordingSettings={save}
    />,
  )
  return { save }
}

describe('RecordingSettingsSection', () => {
  it('shows each duration as an editable field', async () => {
    renderSection()

    expect(await screen.findByLabelText('Séquences de mouvement')).toHaveValue(7)
    expect(screen.getByLabelText('Vidéo complète')).toHaveValue(0)
    expect(screen.getByLabelText('Clips d’alerte')).toHaveValue(14)
  })

  // Same affordance as a camera, one level up: the fallback here is what Vyzio ships with.
  it('offers no revert while every duration is still the shipped one', async () => {
    renderSection()
    await screen.findByLabelText('Séquences de mouvement')

    expect(
      screen.queryByRole('button', { name: /Revenir à la valeur d’origine/ }),
    ).not.toBeInTheDocument()
  })

  it('offers a revert only on a duration that was changed', async () => {
    renderSection({ ...AS_SHIPPED, motion: { days: 30, default: 7 } })
    await screen.findByLabelText('Séquences de mouvement')

    const reverts = screen.getAllByRole('button', { name: /Revenir à la valeur d’origine/ })
    expect(reverts).toHaveLength(1)
    expect(reverts[0]).toHaveAccessibleName('Revenir à la valeur d’origine : 7 jours')
  })

  it('restores the shipped duration when the revert is used', async () => {
    const user = userEvent.setup()
    const { save } = renderSection({ ...AS_SHIPPED, motion: { days: 30, default: 7 } })
    await screen.findByLabelText('Séquences de mouvement')

    await user.click(screen.getByRole('button', { name: /Revenir à la valeur d’origine/ }))

    expect(save.execute).toHaveBeenCalledWith({
      continuousDays: 0,
      motionDays: 7,
      eventClipDays: 14,
    })
  })

  // Saved on leaving the field, so a half-typed number never reaches the server.
  it('saves an edited duration once the field is left, carrying the others through', async () => {
    const { save } = renderSection()
    const field = await screen.findByLabelText('Séquences de mouvement')

    fireEvent.change(field, { target: { value: '21' } })
    expect(save.execute).not.toHaveBeenCalled()

    fireEvent.blur(field)
    expect(save.execute).toHaveBeenCalledWith({
      continuousDays: 0,
      motionDays: 21,
      eventClipDays: 14,
    })
  })

  it('warns about disk usage only when full video is kept', async () => {
    renderSection()
    await screen.findByLabelText('Vidéo complète')
    expect(screen.queryByText(/1 à 3 Go par jour/)).not.toBeInTheDocument()
  })
})
