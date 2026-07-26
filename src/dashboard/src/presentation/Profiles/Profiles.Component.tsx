import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { useToast } from '../../common/components/Toast'
import { Btn } from '../../common/components/Btn'
import { Select } from '../../common/components/Select'
import { usePresenter } from '../../common/presenter/usePresenter'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type { Profile } from '../../domain/entities/Profile'
import type { ProfileCameraLink } from '../../domain/entities/ProfileCameraLink'
import type { ProfilePhoto } from '../../domain/entities/ProfilePhoto'
import { buildProfilesPresenter } from './Profiles.Presenter'
import { profilesReducer } from './Profiles.Reducer'
import { buildInitialProfilesUido, type ProfileDetailTab } from './Profiles.Uido'

const ALERT_MODE_OPTIONS = [
  { value: 'always', label: 'Toujours alerter' },
  { value: 'never', label: 'Ne jamais alerter' },
]

const CATEGORY_OPTIONS = [
  { value: 'family', label: 'Famille' },
  { value: 'friend', label: 'Ami' },
  { value: 'staff', label: 'Personnel' },
  { value: 'other', label: 'Autre' },
]

export function ProfilesView() {
  const { apiBaseUrl, profiles: container } = useAppContainer()
  const [uido, dispatch] = useReducer(profilesReducer, undefined, buildInitialProfilesUido)
  const presenter = usePresenter(buildProfilesPresenter, { container, dispatch })

  useEffect(() => {
    presenter.onMount()
  }, [presenter])

  const selectedProfile = uido.profiles.find((p) => p.id === uido.selectedId) ?? null

  return (
    <div className="app-shell app-shell-cameras">
      <div className="camera-toolbar panel">
        <div className="camera-toolbar-copy">
          <p className="eyebrow">Profils</p>
          <h1>Gestion des personnes connues</h1>
          <p className="camera-toolbar-lede">
            Creez des profils pour les personnes que Vyzio doit reconnaitre et configurez leurs
            alertes.
          </p>
        </div>
        <div className="camera-toolbar-status">
          <div className={`status-pill ${uido.profiles.length > 0 ? 'online' : 'warning'}`}>
            {uido.profiles.length === 0
              ? 'Aucun profil'
              : `${uido.profiles.length} profil${uido.profiles.length > 1 ? 's' : ''}`}
          </div>
          {uido.error && (
            <p
              style={{
                color: 'var(--status-degraded, #e05252)',
                marginTop: 8,
                fontSize: '0.88rem',
              }}
            >
              {uido.error}
            </p>
          )}
        </div>
      </div>

      <div className="camera-master-detail">
        <aside className="camera-sidebar panel">
          <div className="camera-sidebar-group">
            <div className="camera-sidebar-header">
              <h2>Profils</h2>
              <span className="camera-sidebar-count">{uido.profiles.length}</span>
            </div>
            <button
              type="button"
              className="primary-cta camera-sidebar-btn"
              onClick={() => presenter.onNew()}
            >
              + Nouveau profil
            </button>

            {uido.loading && <p style={{ padding: '12px 16px', opacity: 0.6 }}>Chargement…</p>}

            {uido.profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={`camera-nav-item${uido.selectedId === profile.id ? ' selected' : ''}`}
                onClick={() => presenter.onSelect(profile.id)}
              >
                <div className="candidate-preview-main">
                  <strong>{profile.name}</strong>
                  <p>
                    {CATEGORY_OPTIONS.find((c) => c.value === profile.category)?.label ??
                      profile.category}
                  </p>
                </div>
                <div className="camera-nav-meta">
                  <span
                    className={`camera-support-badge ${profile.alertMode === 'never' ? 'unknown' : 'supported'}`}
                  >
                    {ALERT_MODE_OPTIONS.find((a) => a.value === profile.alertMode)?.label ??
                      profile.alertMode}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="camera-detail-panel panel">
          {uido.creating && (
            <ProfileForm
              profile={null}
              onSave={(name, category, alertMode) => presenter.onCreate(name, category, alertMode)}
              onCancel={() => presenter.onCreatingCancelled()}
            />
          )}

          {!uido.creating && selectedProfile && (
            <>
              <div className="profile-tabs">
                {(['info', 'photos', 'cameras'] as ProfileDetailTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`profile-tab-btn${uido.tab === t ? ' active' : ''}`}
                    onClick={() => presenter.onTabSet(t)}
                  >
                    {t === 'info' ? 'Informations' : t === 'photos' ? 'Photos' : 'Caméras'}
                  </button>
                ))}
              </div>

              {uido.tab === 'info' && (
                <ProfileInfoTab
                  profile={selectedProfile}
                  onSave={(name, category, alertMode) =>
                    presenter.onUpdate(selectedProfile.id, name, category, alertMode)
                  }
                  onDelete={() => presenter.onConfirmDeleteSet(selectedProfile.id)}
                />
              )}
              {uido.tab === 'photos' && (
                <ProfilePhotosTab
                  profileId={selectedProfile.id}
                  apiBaseUrl={apiBaseUrl}
                  onResync={() => presenter.onConfirmResyncSet(true)}
                  resyncing={uido.resyncLoading}
                  resyncMessage={uido.resyncMessage}
                />
              )}
              {uido.tab === 'cameras' && <ProfileCamerasTab profileId={selectedProfile.id} />}
            </>
          )}

          {uido.confirmResync && (
            <ConfirmModal
              title="Resynchroniser la bibliothèque de visages"
              body="Vyzio va retransmettre toutes les photos de profil à Frigate pour recalculer les embeddings de reconnaissance. Cette opération peut prendre de quelques secondes à plusieurs minutes selon le nombre de photos."
              confirmLabel="Resynchroniser"
              onConfirm={async () => {
                presenter.onConfirmResyncSet(false)
                await presenter.onResync()
              }}
              onCancel={() => presenter.onConfirmResyncSet(false)}
            />
          )}

          {uido.confirmDeleteProfileId &&
            (() => {
              const profile = uido.profiles.find((p) => p.id === uido.confirmDeleteProfileId)
              return (
                <ConfirmModal
                  title="Supprimer le profil"
                  body={`Supprimer le profil "${profile?.name ?? ''}" ? Toutes les photos associées seront perdues et la reconnaissance faciale ne fonctionnera plus pour cette personne.`}
                  confirmLabel="Supprimer le profil"
                  tone="danger"
                  onConfirm={() => presenter.onDelete(uido.confirmDeleteProfileId!)}
                  onCancel={() => presenter.onConfirmDeleteSet(null)}
                />
              )
            })()}

          {!uido.creating && !selectedProfile && !uido.loading && (
            <div className="camera-detail-section">
              <p className="camera-toolbar-lede">Selectionnez un profil ou creez-en un nouveau.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProfileForm({
  profile,
  onSave,
  onCancel,
}: {
  profile: Profile | null
  onSave: (name: string, category: string, alertMode: string) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(profile?.name ?? '')
  const [category, setCategory] = useState(profile?.category ?? 'family')
  const [alertMode, setAlertMode] = useState(profile?.alertMode ?? 'always')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setErr('Le nom est requis.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      await onSave(name.trim(), category, alertMode)
    } catch {
      setErr("Erreur lors de l'enregistrement.")
      setSaving(false)
    }
  }

  return (
    <section className="camera-detail-section">
      <h3>{profile ? 'Modifier le profil' : 'Nouveau profil'}</h3>
      <form onSubmit={handleSubmit} className="camera-form">
        <div className="camera-form-field">
          <label htmlFor="profile-name">Nom</label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Alice Martin"
            autoFocus
          />
        </div>

        <div className="camera-form-field">
          <label htmlFor="profile-category">Categorie</label>
          <Select
            id="profile-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="camera-form-field">
          <label htmlFor="profile-alert">Mode d'alerte</label>
          <Select
            id="profile-alert"
            value={alertMode}
            onChange={(e) => setAlertMode(e.target.value)}
          >
            {ALERT_MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {err && (
          <p style={{ color: 'var(--status-degraded, #e05252)', fontSize: '0.88rem' }}>{err}</p>
        )}

        <div className="camera-form-actions">
          <Btn type="submit" variant="primary" size="md" loading={saving}>
            Enregistrer
          </Btn>
          <Btn variant="ghost" size="md" onClick={onCancel}>
            Annuler
          </Btn>
        </div>
      </form>
    </section>
  )
}

function ProfileInfoTab({
  profile,
  onSave,
  onDelete,
}: {
  profile: Profile
  onSave: (name: string, category: string, alertMode: string) => Promise<void>
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave(name: string, category: string, alertMode: string) {
    setSaving(true)
    await onSave(name, category, alertMode)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return <ProfileForm profile={profile} onSave={handleSave} onCancel={() => setEditing(false)} />
  }

  return (
    <>
      <section className="camera-detail-section">
        <h3>Informations</h3>
        <dl className="camera-summary-list">
          <div>
            <dt>Nom</dt>
            <dd>{profile.name}</dd>
          </div>
          <div>
            <dt>Categorie</dt>
            <dd>
              {CATEGORY_OPTIONS.find((c) => c.value === profile.category)?.label ??
                profile.category}
            </dd>
          </div>
          <div>
            <dt>Mode d'alerte</dt>
            <dd>
              {ALERT_MODE_OPTIONS.find((a) => a.value === profile.alertMode)?.label ??
                profile.alertMode}
            </dd>
          </div>
          {profile.lastSeenAt && (
            <div>
              <dt>Derniere detection</dt>
              <dd>{new Date(profile.lastSeenAt).toLocaleString('fr-FR')}</dd>
            </div>
          )}
          <div>
            <dt>Cree le</dt>
            <dd>{new Date(profile.createdAt).toLocaleString('fr-FR')}</dd>
          </div>
        </dl>
      </section>

      <div className="camera-form-actions" style={{ padding: '0 0 16px' }}>
        <Btn variant="primary" size="md" loading={saving} onClick={() => setEditing(true)}>
          Modifier
        </Btn>
        <Btn variant="danger-outline" size="md" onClick={onDelete} style={{ marginLeft: 'auto' }}>
          Supprimer le profil
        </Btn>
      </div>
    </>
  )
}

function ProfilePhotosTab({
  profileId,
  apiBaseUrl,
  onResync,
  resyncing,
  resyncMessage,
}: {
  profileId: string
  apiBaseUrl: string
  onResync: () => void
  resyncing: boolean
  resyncMessage: string | null
}) {
  const { getProfilePhotos, addProfilePhoto, removeProfilePhoto } = useAppContainer().profiles
  const { toast } = useToast()
  const [photos, setPhotos] = useState<ProfilePhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [confirmDeletePhotoId, setConfirmDeletePhotoId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const MIN_PHOTOS = 3

  // Loads on mount/profile change without a synchronous setState at the top of the effect: all
  // setState calls happen inside the promise callbacks, so switching profiles just swaps the photo
  // grid in place instead of flashing "Chargement…" over the still-valid previous one.
  useEffect(() => {
    let cancelled = false
    getProfilePhotos
      .execute(profileId)
      .then((list) => {
        if (!cancelled) setPhotos(list)
      })
      .catch(() => {
        if (!cancelled) toast('Impossible de charger les photos.', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profileId, getProfilePhotos, toast])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const photo = await addProfilePhoto.execute(profileId, file)
      setPhotos((prev) => [...prev, photo])
      toast('Photo ajoutée', 'success')
    } catch {
      toast("Erreur lors de l'envoi de la photo.", 'error')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDeletePhoto(photoId: string) {
    try {
      await removeProfilePhoto.execute(profileId, photoId)
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      setConfirmDeletePhotoId(null)
      toast('Photo supprimée', 'info')
    } catch {
      toast('Impossible de supprimer la photo.', 'error')
      setConfirmDeletePhotoId(null)
    }
  }

  const photoTone = photos.length === 0 ? 'none' : photos.length < MIN_PHOTOS ? 'warn' : 'ok'

  return (
    <section className="camera-detail-section">
      <div className="profile-photos-header">
        <h3>Photos de reconnaissance</h3>
        <div className="profile-photos-actions">
          <Btn variant="secondary" size="sm" loading={resyncing} onClick={onResync}>
            Resynchroniser
          </Btn>
          <Btn
            variant="primary"
            size="sm"
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            + Photo
          </Btn>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
        </div>
      </div>

      {resyncMessage && <p className="profile-resync-msg">{resyncMessage}</p>}

      {loading && <p className="profile-loading">Chargement…</p>}

      {!loading && (
        <div className={`photo-count-bar photo-count-bar--${photoTone}`}>
          <span className="photo-count-number">{photos.length}</span>
          <span className="photo-count-label">
            {photos.length < MIN_PHOTOS
              ? `photo${photos.length !== 1 ? 's' : ''} — minimum ${MIN_PHOTOS} recommandées pour une reconnaissance fiable`
              : `photo${photos.length !== 1 ? 's' : ''} — seuil minimum atteint`}
          </span>
        </div>
      )}

      {!loading && photos.length === 0 && (
        <p className="profile-empty-hint">
          Ajoutez des photos nettes de face pour activer la reconnaissance. Privilégiez des angles
          variés.
        </p>
      )}

      {photos.length > 0 && (
        <div className="profile-photo-grid">
          {photos.map((photo) => (
            <div key={photo.id} className="profile-photo-item">
              <img
                src={`${apiBaseUrl}/api/profiles/${profileId}/photos/${photo.filename}`}
                alt={photo.filename}
                className="profile-photo-img"
              />
              <div className="profile-photo-sync">
                <span
                  className={`camera-support-badge ${photo.frigateSynced ? 'supported' : 'unknown'}`}
                >
                  {photo.frigateSynced ? 'Sync' : 'En attente'}
                </span>
              </div>
              <button
                type="button"
                className="profile-photo-delete"
                onClick={() => setConfirmDeletePhotoId(photo.id)}
                title="Supprimer"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {confirmDeletePhotoId && (
        <ConfirmModal
          title="Supprimer la photo"
          body="Cette photo sera définitivement supprimée. Si c'est la dernière photo du profil, la reconnaissance faciale sera désactivée pour cette personne."
          confirmLabel="Supprimer la photo"
          tone="danger"
          onConfirm={() => handleDeletePhoto(confirmDeletePhotoId)}
          onCancel={() => setConfirmDeletePhotoId(null)}
        />
      )}
    </section>
  )
}

function ProfileCamerasTab({ profileId }: { profileId: string }) {
  const { getProfileCameraLinks, setProfileCameraLinks } = useAppContainer().profiles
  const { toast } = useToast()
  const [links, setLinks] = useState<ProfileCameraLink[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Loads on mount/profile change without a synchronous setState at the top of the effect: all
  // setState calls happen inside the promise callbacks, so switching profiles just swaps the
  // camera-links list in place instead of flashing "Chargement…" over the still-valid previous one.
  useEffect(() => {
    let cancelled = false
    getProfileCameraLinks
      .execute(profileId)
      .then((list) => {
        if (cancelled) return
        setLinks(list)
        setSelected(new Set(list.filter((l) => l.enabled).map((l) => l.cameraId)))
      })
      .catch(() => {
        if (!cancelled) toast('Impossible de charger les caméras liées.', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profileId, getProfileCameraLinks, toast])

  function toggle(cameraId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(cameraId)) next.delete(cameraId)
      else next.add(cameraId)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await setProfileCameraLinks.execute(profileId, [...selected])
      setLinks(updated)
      setSelected(new Set(updated.filter((l) => l.enabled).map((l) => l.cameraId)))
      toast('Associations enregistrées', 'success')
    } catch {
      toast("Erreur lors de l'enregistrement des associations.", 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="camera-detail-section">
      <h3>Caméras associées</h3>
      <p className="camera-section-copy">
        Limitez la reconnaissance de ce profil aux caméras sélectionnées. Sans sélection, le profil
        est reconnu sur toutes les caméras.
      </p>

      {loading && <p className="profile-loading">Chargement…</p>}

      {!loading && links.length === 0 && (
        <p className="camera-section-footnote">Aucune caméra configurée dans Vyzio.</p>
      )}

      <div className="profile-camera-list">
        {links.map((link) => (
          <label key={link.cameraId} className="profile-camera-item">
            <input
              type="checkbox"
              checked={selected.has(link.cameraId)}
              onChange={() => toggle(link.cameraId)}
            />
            <span>{link.cameraDisplayName ?? link.cameraId}</span>
          </label>
        ))}
      </div>

      {!loading && (
        <div className="camera-form-actions">
          <Btn variant="primary" size="md" loading={saving} onClick={handleSave}>
            Enregistrer
          </Btn>
        </div>
      )}
    </section>
  )
}
