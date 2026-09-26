import type { VendorAssistance } from '../entities/vendor_assistance.entity'
import type { CameraRepository, VendorAssistanceRequest } from '../ports/camera.port'

export class GetVendorAssistance {
  constructor(private readonly repository: CameraRepository) {}

  async execute(input: VendorAssistanceRequest): Promise<VendorAssistance | null> {
    return this.repository.getVendorAssistance(input)
  }
}
