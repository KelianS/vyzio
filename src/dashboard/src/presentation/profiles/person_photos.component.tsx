import { useEffect, useReducer, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { Badge } from '../../common/components/badge'
import { Button } from '../../common/ui/button'
import { SettingsPage } from '../../common/settings/settings_page'
import { AdvancedFold } from '../../common/settings/advanced_fold'
import { useToast } from '../../common/components/toast'
import { ConfirmModal } from '../../common/components/confirm_modal'
import { ReadFailure } from '../../common/components/error_message'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { usePerson } from './person_context'
import { buildPersonPhotosPresenter } from './person_photos.presenter'
import { personPhotosReducer } from './person_photos.reducer'
import { buildInitialPersonPhotosUido } from './person_photos.uido'

/** Below this, recognition misfires more than it recognizes. */
const ADVISED_PHOTOS = 3

export function PersonPhotosView() {
  const { person } = usePerson()
  const { apiBaseUrl, profiles: container } = useAppContainer()
  const { toast } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uido, dispatch] = useReducer(personPhotosReducer, undefined, buildInitialPersonPhotosUido)
  const presenter = usePresenter(buildPersonPhotosPresenter, { container, dispatch, toast })

  const personId = person.id
  const count = uido.photos.length

  useEffect(() => {
    presenter.onLoad(personId)
  }, [presenter, personId])

  // An unread gallery is not an empty one: "recognition is off" would be false.
  if (uido.error)
    return (
      <SettingsPage>
        <ReadFailure error={uido.error} onRetry={() => presenter.onLoad(personId)} />
      </SettingsPage>
    )

  return (
    <>
      <SettingsPage lede={describeCoverage(count, uido.loading)}>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={uido.uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uido.uploading ? 'Envoi…' : 'Ajouter une photo'}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void presenter.onUpload(personId, file)
            }}
          />
        </div>

        {count > 0 && (
          <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
            {uido.photos.map((photo) => (
              <li key={photo.id} className="relative">
                <img
                  src={`${apiBaseUrl}/api/profiles/${person.id}/photos/${photo.filename}`}
                  alt=""
                  className="aspect-square w-full rounded-lg object-cover"
                />
                <Badge
                  tone={photo.frigateSynced ? 'ok' : 'neutral'}
                  className="absolute bottom-1 left-1"
                >
                  {photo.frigateSynced ? 'Prise en compte' : 'En attente'}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Supprimer la photo ${photo.filename}`}
                  className="absolute top-1 right-1 bg-card/80"
                  onClick={() => presenter.onAskRemove(photo.id)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {count === 0 && !uido.loading && (
          <p className="mt-5 text-muted-foreground">
            Des photos nettes, de face, sous plusieurs angles : c’est ce qui permet de la
            reconnaître.
          </p>
        )}

        <AdvancedFold lede="Si une photo reste « en attente », renvoyez toute la bibliothèque au moteur de reconnaissance.">
          <Button
            type="button"
            variant="outline"
            disabled={uido.resyncing}
            onClick={presenter.onAskResync}
          >
            {uido.resyncing ? 'Reprise…' : 'Reprendre toutes les photos'}
          </Button>
        </AdvancedFold>
      </SettingsPage>

      {uido.confirmRemoveId && (
        <ConfirmModal
          title="Supprimer cette photo ?"
          body={
            count === 1
              ? 'C’est la dernière : sans photo, Vyzio ne pourra plus reconnaître cette personne.'
              : 'La reconnaissance s’appuiera sur les photos restantes.'
          }
          confirmLabel="Supprimer"
          tone="danger"
          loading={uido.removing}
          onConfirm={() => presenter.onRemove(personId, uido.confirmRemoveId!)}
          onCancel={presenter.onCancelRemove}
        />
      )}

      {uido.confirmResync && (
        <ConfirmModal
          title="Reprendre toutes les photos ?"
          body="Toutes les photos de toutes les personnes sont réanalysées. Selon leur nombre, cela prend de quelques secondes à plusieurs minutes."
          confirmLabel="Reprendre"
          tone="confirm"
          loading={uido.resyncing}
          onConfirm={presenter.onResync}
          onCancel={presenter.onCancelResync}
        />
      )}
    </>
  )
}

/** States where the count stands relative to the threshold, instead of a bare number. */
function describeCoverage(count: number, loading: boolean): string {
  if (loading) return 'Chargement…'
  if (count === 0) return 'Aucune photo : la reconnaissance est inactive pour cette personne.'
  if (count < ADVISED_PHOTOS) {
    return `${count} photo${count > 1 ? 's' : ''} : au moins ${ADVISED_PHOTOS} pour une reconnaissance fiable.`
  }
  return `${count} photos : de quoi la reconnaître dans des conditions variées.`
}
