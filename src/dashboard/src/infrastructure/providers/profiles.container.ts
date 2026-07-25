import { AddProfilePhoto } from '../../domain/usecases/AddProfilePhoto'
import { CreateProfile } from '../../domain/usecases/CreateProfile'
import { DeleteProfile } from '../../domain/usecases/DeleteProfile'
import { GetProfileCameraLinks } from '../../domain/usecases/GetProfileCameraLinks'
import { GetProfilePhotos } from '../../domain/usecases/GetProfilePhotos'
import { GetProfiles } from '../../domain/usecases/GetProfiles'
import { RemoveProfilePhoto } from '../../domain/usecases/RemoveProfilePhoto'
import { ResyncFaceLibrary } from '../../domain/usecases/ResyncFaceLibrary'
import { SetProfileCameraLinks } from '../../domain/usecases/SetProfileCameraLinks'
import { UpdateProfile } from '../../domain/usecases/UpdateProfile'
import type { ProfileRepository } from '../../domain/ports/ProfileRepository'

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
