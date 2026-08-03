import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Badge } from '../../common/components/Badge'
import { Button } from '../../common/ui/button'
import { SettingsPage, SettingsSection } from '../../common/settings/SettingsPage'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { usePerson } from './personContext'

/** Below this, recognition misfires more than it recognizes. */
const ADVISED_PHOTOS = 3

export function PersonPhotosPage() {
  const { person } = usePerson()
  const { apiBaseUrl, profiles: container } = useAppContainer()
  const { toast } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmResync, setConfirmResync] = useState(false)

  const photos = useAsync(() => container.getProfilePhotos.execute(person.id), [person.id])
  const count = photos.data?.length ?? 0

  const uploading = useAsyncAction(
    async (file: File) => container.addProfilePhoto.execute(person.id, file),
    {
      onSuccess: () => {
        toast('Photo ajoutée.', 'success')
        photos.reload()
      },
    },
  )

  const removing = useAsyncAction(
    async (photoId: string) => container.removeProfilePhoto.execute(person.id, photoId),
    {
      onSuccess: () => {
        toast('Photo supprimée.', 'info')
        photos.reload()
      },
    },
  )

  const resyncing = useAsyncAction(async () => container.resyncFaceLibrary.execute(), {
    onSuccess: (synced) => toast(`${synced ?? 0} photo(s) reprise(s).`, 'success'),
  })

  return (
    <>
      <SettingsPage lede={describeCoverage(count, photos.loading)}>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={uploading.loading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading.loading ? 'Envoi…' : 'Ajouter une photo'}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void uploading.run(file)
            }}
          />
        </div>

        {count > 0 && (
          <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
            {photos.data!.map((photo) => (
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
                  onClick={() => setConfirmDelete(photo.id)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {count === 0 && !photos.loading && (
          <p className="mt-5 text-muted-foreground">
            Des photos nettes, de face, sous plusieurs angles : c’est ce qui permet de la
            reconnaître.
          </p>
        )}

        <SettingsSection
          title="Avancé"
          lede="Si une photo reste « en attente », renvoyez toute la bibliothèque au moteur de reconnaissance."
        >
          <Button
            type="button"
            variant="outline"
            disabled={resyncing.loading}
            onClick={() => setConfirmResync(true)}
          >
            {resyncing.loading ? 'Reprise…' : 'Reprendre toutes les photos'}
          </Button>
        </SettingsSection>
      </SettingsPage>

      {confirmDelete && (
        <ConfirmModal
          title="Supprimer cette photo ?"
          body={
            count === 1
              ? 'C’est la dernière : sans photo, Vyzio ne pourra plus reconnaître cette personne.'
              : 'La reconnaissance s’appuiera sur les photos restantes.'
          }
          confirmLabel="Supprimer"
          tone="danger"
          loading={removing.loading}
          onConfirm={async () => {
            await removing.run(confirmDelete)
            setConfirmDelete(null)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmResync && (
        <ConfirmModal
          title="Reprendre toutes les photos ?"
          body="Toutes les photos de toutes les personnes sont réanalysées. Selon leur nombre, cela prend de quelques secondes à plusieurs minutes."
          confirmLabel="Reprendre"
          tone="confirm"
          loading={resyncing.loading}
          onConfirm={async () => {
            await resyncing.run()
            setConfirmResync(false)
          }}
          onCancel={() => setConfirmResync(false)}
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
    return `${count} photo${count > 1 ? 's' : ''} — au moins ${ADVISED_PHOTOS} pour une reconnaissance fiable.`
  }
  return `${count} photos — de quoi la reconnaître dans des conditions variées.`
}
