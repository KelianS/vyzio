import { useReducer } from 'react'
import { RefreshCw } from 'lucide-react'
import { SecondaryButton } from '../../common/components/secondary_button'
import { AdvancedPage } from '../../common/settings/advanced'
import { useToast } from '../../common/components/toast'
import { ConfirmModal } from '../../common/components/confirm_modal'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { buildPersonPhotosPresenter } from './person_photos.presenter'
import { personPhotosReducer } from './person_photos.reducer'
import { buildInitialPersonPhotosUido } from './person_photos.uido'

/** The Avancé page of a person's photos: sending the whole library again to recognition (UI-09). */
export function PersonPhotosAdvancedView() {
  const { profiles: container } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(personPhotosReducer, undefined, buildInitialPersonPhotosUido)
  const presenter = usePresenter(buildPersonPhotosPresenter, { container, dispatch, toast })

  return (
    <>
      <AdvancedPage lede="Si une photo reste « en attente », renvoyez toute la bibliothèque au moteur de reconnaissance.">
        <div>
          <SecondaryButton
            icon={RefreshCw}
            type="button"
            disabled={uido.resyncing}
            onClick={presenter.onAskResync}
          >
            {uido.resyncing ? 'Reprise…' : 'Reprendre toutes les photos'}
          </SecondaryButton>
        </div>
      </AdvancedPage>

      {uido.confirmResync && (
        <ConfirmModal
          title="Reprendre toutes les photos ?"
          body="Toutes les photos de toutes les personnes sont réanalysées. Selon leur nombre, cela prend de quelques secondes à plusieurs minutes."
          confirmLabel="Reprendre"
          loading={uido.resyncing}
          onConfirm={presenter.onResync}
          onCancel={presenter.onCancelResync}
        />
      )}
    </>
  )
}
