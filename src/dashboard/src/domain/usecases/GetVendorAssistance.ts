import type { VendorAssistance } from '../entities/VendorAssistance'
import type { CameraRepository, VendorAssistanceRequest } from '../ports/CameraRepository'

export class GetVendorAssistance {
  constructor(private readonly repository: CameraRepository) {}

  async execute(input: VendorAssistanceRequest): Promise<VendorAssistance | null> {
    return this.repository.getVendorAssistance(input)
  }
}
