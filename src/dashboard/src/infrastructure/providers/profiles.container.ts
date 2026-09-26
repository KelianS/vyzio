import { AddProfilePhoto } from '../../domain/usecases/add_profile_photo.use_case'
import { CreateProfile } from '../../domain/usecases/create_profile.use_case'
import { DeleteProfile } from '../../domain/usecases/delete_profile.use_case'
import { GetProfileCameraLinks } from '../../domain/usecases/get_profile_camera_links.use_case'
import { GetProfilePhotos } from '../../domain/usecases/get_profile_photos.use_case'
import { GetProfiles } from '../../domain/usecases/get_profiles.use_case'
import { RemoveProfilePhoto } from '../../domain/usecases/remove_profile_photo.use_case'
import { ResyncFaceLibrary } from '../../domain/usecases/resync_face_library.use_case'
import { SetProfileCameraLinks } from '../../domain/usecases/set_profile_camera_links.use_case'
import { UpdateProfile } from '../../domain/usecases/update_profile.use_case'
import type { ProfileRepository } from '../../domain/ports/profile.port'

export interface ProfilesContainer {
  getProfiles: GetProfiles
  createProfile: CreateProfile
  updateProfile: UpdateProfile
  deleteProfile: DeleteProfile
  getProfilePhotos: GetProfilePhotos
  addProfilePhoto: AddProfilePhoto
  removeProfilePhoto: RemoveProfilePhoto
  resyncFaceLibrary: ResyncFaceLibrary
  getProfileCameraLinks: GetProfileCameraLinks
  setProfileCameraLinks: SetProfileCameraLinks
}

export function makeProfilesContainer(profileRepository: ProfileRepository): ProfilesContainer {
  return {
    getProfiles: new GetProfiles(profileRepository),
    createProfile: new CreateProfile(profileRepository),
    updateProfile: new UpdateProfile(profileRepository),
    deleteProfile: new DeleteProfile(profileRepository),
    getProfilePhotos: new GetProfilePhotos(profileRepository),
    addProfilePhoto: new AddProfilePhoto(profileRepository),
    removeProfilePhoto: new RemoveProfilePhoto(profileRepository),
    resyncFaceLibrary: new ResyncFaceLibrary(profileRepository),
    getProfileCameraLinks: new GetProfileCameraLinks(profileRepository),
    setProfileCameraLinks: new SetProfileCameraLinks(profileRepository),
  }
}
