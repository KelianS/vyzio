import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from './Toast'
import type { AddProfilePhoto } from '../../application/use-cases/AddProfilePhoto'
import type { CreateProfile } from '../../application/use-cases/CreateProfile'
import type { DeleteProfile } from '../../application/use-cases/DeleteProfile'
import type { GetProfileCameraLinks } from '../../application/use-cases/GetProfileCameraLinks'
import type { GetProfilePhotos } from '../../application/use-cases/GetProfilePhotos'
import type { GetProfiles } from '../../application/use-cases/GetProfiles'
import type { RemoveProfilePhoto } from '../../application/use-cases/RemoveProfilePhoto'
import type { ResyncFaceLibrary } from '../../application/use-cases/ResyncFaceLibrary'
import type { SetProfileCameraLinks } from '../../application/use-cases/SetProfileCameraLinks'
import type { UpdateProfile } from '../../application/use-cases/UpdateProfile'
import type { Profile } from '../../domain/entities/Profile'
import type { ProfileCameraLink } from '../../domain/entities/ProfileCameraLink'
import type { ProfilePhoto } from '../../domain/entities/ProfilePhoto'

interface ProfilesViewProps {
  getProfiles: GetProfiles
  createProfile: CreateProfile
  updateProfile: UpdateProfile
  deleteProfile: DeleteProfile
  getProfilePhotos: GetProfilePhotos
  addProfilePhoto: AddProfilePhoto
  removeProfilePhoto: RemoveProfilePhoto
  getProfileCameraLinks: GetProfileCameraLinks
  setProfileCameraLinks: SetProfileCameraLinks
  resyncFaceLibrary: ResyncFaceLibrary
  apiBaseUrl: string
  onBack: () => void
}

type DetailTab = 'info' | 'photos' | 'cameras'

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

export function ProfilesView({
  getProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  getProfilePhotos,
  addProfilePhoto,
  removeProfilePhoto,
  getProfileCameraLinks,
  setProfileCameraLinks,
  resyncFaceLibrary,
  apiBaseUrl,
}: ProfilesViewProps) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<DetailTab>('info')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resyncing, setResyncing] = useState(false)
  const [resyncMessage, setResyncMessage] = useState<string | null>(null)

  const selectedProfile = profiles.find((p) => p.id === selectedId) ?? null

  const { toast } = useToast()

  const loadProfiles = useCallback(() => {
    setLoading(true)
    setError(null)
    getProfiles
      .execute()
      .then((list) => {
        setProfiles(list)
        setLoading(false)
      })
      .catch(() => {
        setError("Impossible de charger les profils.")
        setLoading(false)
      })
  }, [getProfiles])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  function handleSelect(id: string) {
    setSelectedId(id)
    setCreating(false)
    setTab('info')
  }

  function handleNew() {
    setSelectedId(null)
    setCreating(true)
    setTab('info')
  }

  async function handleCreate(name: string, category: string, alertMode: string) {
    const profile = await createProfile.execute({ name, category, alertMode })
    setProfiles((prev) => [...prev, profile])
    setSelectedId(profile.id)
    setCreating(false)
    toast('Profil créé', 'success')
  }

  async function handleUpdate(id: string, name: string, category: string, alertMode: string) {
    const updated = await updateProfile.execute(id, { name, category, alertMode })
    setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)))
    toast('Profil enregistré', 'success')
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Supprimer ce profil ?')) return
    await deleteProfile.execute(id)
    setProfiles((prev) => prev.filter((p) => p.id !== id))
    setSelectedId(null)
    setCreating(false)
    toast('Profil supprimé', 'info')
  }

  async function handleResync() {
    setResyncing(true)
    setResyncMessage(null)
    try {
      const count = await resyncFaceLibrary.execute()
      setResyncMessage(`${count} photo${count !== 1 ? 's' : ''} synchronisee${count !== 1 ? 's' : ''}.`)
    } catch {
      setResyncMessage('Erreur lors de la synchronisation.')
    } finally {
      setResyncing(false)
    }
  }

  return (
    <div className="app-shell app-shell-cameras">
      <div className="camera-toolbar panel">
        <div className="camera-toolbar-copy">
          <p className="eyebrow">Profils</p>
          <h1>Gestion des personnes connues</h1>
          <p className="camera-toolbar-lede">
            Creez des profils pour les personnes que Vyzio doit reconnaitre et configurez leurs alertes.
          </p>
        </div>
        <div className="camera-toolbar-status">
          <div className={`status-pill ${profiles.length > 0 ? 'online' : 'warning'}`}>
            {profiles.length === 0 ? 'Aucun profil' : `${profiles.length} profil${profiles.length > 1 ? 's' : ''}`}
          </div>
          {error && <p style={{ color: 'var(--status-degraded, #e05252)', marginTop: 8, fontSize: '0.88rem' }}>{error}</p>}
        </div>
      </div>

      <div className="camera-master-detail">
        <aside className="camera-sidebar panel">
          <div className="camera-sidebar-group">
            <div className="camera-sidebar-header">
              <h2>Profils</h2>
              <span className="camera-sidebar-count">{profiles.length}</span>
            </div>
            <button type="button" className="primary-cta camera-sidebar-btn" onClick={handleNew}>
              + Nouveau profil
            </button>

            {loading && <p style={{ padding: '12px 16px', opacity: 0.6 }}>Chargement…</p>}

            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={`camera-nav-item${selectedId === profile.id ? ' selected' : ''}`}
                onClick={() => handleSelect(profile.id)}
              >
                <div className="candidate-preview-main">
                  <strong>{profile.name}</strong>
                  <p>{CATEGORY_OPTIONS.find((c) => c.value === profile.category)?.label ?? profile.category}</p>
                </div>
                <div className="camera-nav-meta">
                  <span className={`camera-support-badge ${profile.alertMode === 'never' ? 'unknown' : 'supported'}`}>
                    {ALERT_MODE_OPTIONS.find((a) => a.value === profile.alertMode)?.label ?? profile.alertMode}
                  </span>
                </div>
              </button>
            ))}
          </div>

        </aside>

        <div className="camera-detail-panel panel">
          {creating && (
            <ProfileForm
              profile={null}
              onSave={(name, category, alertMode) => handleCreate(name, category, alertMode)}
              onCancel={() => setCreating(false)}
            />
          )}

          {!creating && selectedProfile && (
            <>
              <div className="profile-tabs">
                {(['info', 'photos', 'cameras'] as DetailTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`profile-tab-btn${tab === t ? ' active' : ''}`}
                    onClick={() => setTab(t)}
                  >
                    {t === 'info' ? 'Informations' : t === 'photos' ? 'Photos' : 'Caméras'}
                  </button>
                ))}
              </div>

              {tab === 'info' && (
                <ProfileInfoTab
                  profile={selectedProfile}
                  onSave={(name, category, alertMode) => handleUpdate(selectedProfile.id, name, category, alertMode)}
                  onDelete={() => handleDelete(selectedProfile.id)}
                />
              )}
              {tab === 'photos' && (
                <ProfilePhotosTab
                  profileId={selectedProfile.id}
                  getProfilePhotos={getProfilePhotos}
                  addProfilePhoto={addProfilePhoto}
                  removeProfilePhoto={removeProfilePhoto}
                  apiBaseUrl={apiBaseUrl}
                  onResync={handleResync}
                  resyncing={resyncing}
                  resyncMessage={resyncMessage}
                />
              )}
              {tab === 'cameras' && (
                <ProfileCamerasTab
                  profileId={selectedProfile.id}
                  getProfileCameraLinks={getProfileCameraLinks}
                  setProfileCameraLinks={setProfileCameraLinks}
                />
              )}
            </>
          )}

          {!creating && !selectedProfile && !loading && (
            <div className="camera-detail-section">
              <p className="camera-toolbar-lede">
                Selectionnez un profil ou creez-en un nouveau.
              </p>
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('Le nom est requis.'); return }
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
          <select id="profile-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="camera-form-field">
          <label htmlFor="profile-alert">Mode d'alerte</label>
          <select id="profile-alert" value={alertMode} onChange={(e) => setAlertMode(e.target.value)}>
            {ALERT_MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {err && <p style={{ color: 'var(--status-degraded, #e05252)', fontSize: '0.88rem' }}>{err}</p>}

        <div className="camera-form-actions">
          <button type="submit" className="primary-cta" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className="secondary-cta" onClick={onCancel}>
            Annuler
          </button>
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
  onDelete: () => Promise<void>
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
          <div><dt>Nom</dt><dd>{profile.name}</dd></div>
          <div>
            <dt>Categorie</dt>
            <dd>{CATEGORY_OPTIONS.find((c) => c.value === profile.category)?.label ?? profile.category}</dd>
          </div>
          <div>
            <dt>Mode d'alerte</dt>
            <dd>{ALERT_MODE_OPTIONS.find((a) => a.value === profile.alertMode)?.label ?? profile.alertMode}</dd>
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
        <button type="button" className="primary-cta" onClick={() => setEditing(true)} disabled={saving}>
          Modifier
        </button>
        <button
          type="button"
          className="secondary-cta"
          onClick={onDelete}
          style={{ color: 'var(--status-degraded, #e05252)', marginLeft: 'auto' }}
        >
          Supprimer le profil
        </button>
      </div>
    </>
  )
}

function ProfilePhotosTab({
  profileId,
  getProfilePhotos,
  addProfilePhoto,
  removeProfilePhoto,
  apiBaseUrl,
  onResync,
  resyncing,
  resyncMessage,
}: {
  profileId: string
  getProfilePhotos: GetProfilePhotos
  addProfilePhoto: AddProfilePhoto
  removeProfilePhoto: RemoveProfilePhoto
  apiBaseUrl: string
  onResync: () => void
  resyncing: boolean
  resyncMessage: string | null
}) {
  const { toast } = useToast()
  const [photos, setPhotos] = useState<ProfilePhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const MIN_PHOTOS = 3

  const load = useCallback(() => {
    setLoading(true)
    getProfilePhotos
      .execute(profileId)
      .then((list) => { setPhotos(list); setLoading(false) })
      .catch(() => { toast('Impossible de charger les photos.', 'error'); setLoading(false) })
  }, [profileId, getProfilePhotos, toast])

  useEffect(() => { load() }, [load])

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

  async function handleDelete(photoId: string) {
    if (!window.confirm('Supprimer cette photo ?')) return
    try {
      await removeProfilePhoto.execute(profileId, photoId)
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      toast('Photo supprimée', 'info')
    } catch {
      toast('Impossible de supprimer la photo.', 'error')
    }
  }

  const photoTone =
    photos.length === 0 ? 'none' : photos.length < MIN_PHOTOS ? 'warn' : 'ok'

  return (
    <section className="camera-detail-section">
      <div className="profile-photos-header">
        <h3>Photos de reconnaissance</h3>
        <div className="profile-photos-actions">
          <button
            type="button"
            className="secondary-cta profile-action-btn"
            onClick={onResync}
            disabled={resyncing}
          >
            {resyncing ? 'Synchronisation…' : 'Resynchroniser'}
          </button>
          <button
            type="button"
            className="primary-cta profile-action-btn"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Envoi…' : '+ Photo'}
          </button>
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
          Ajoutez des photos nettes de face pour activer la reconnaissance.
          Privilégiez des angles variés.
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
                <span className={`camera-support-badge ${photo.frigateSynced ? 'supported' : 'unknown'}`}>
                  {photo.frigateSynced ? 'Sync' : 'En attente'}
                </span>
              </div>
              <button
                type="button"
                className="profile-photo-delete"
                onClick={() => handleDelete(photo.id)}
                title="Supprimer"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ProfileCamerasTab({
  profileId,
  getProfileCameraLinks,
  setProfileCameraLinks,
}: {
  profileId: string
  getProfileCameraLinks: GetProfileCameraLinks
  setProfileCameraLinks: SetProfileCameraLinks
}) {
  const { toast } = useToast()
  const [links, setLinks] = useState<ProfileCameraLink[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(() => {
    setLoading(true)
    getProfileCameraLinks
      .execute(profileId)
      .then((list) => {
        setLinks(list)
        setSelected(new Set(list.filter((l) => l.enabled).map((l) => l.cameraId)))
        setLoading(false)
      })
      .catch(() => { toast('Impossible de charger les caméras liées.', 'error'); setLoading(false) })
  }, [profileId, getProfileCameraLinks, toast])

  useEffect(() => { load() }, [load])

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
        Limitez la reconnaissance de ce profil aux caméras sélectionnées. Sans sélection, le profil est reconnu sur toutes les caméras.
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
          <button type="button" className="primary-cta" onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      )}
    </section>
  )
}
