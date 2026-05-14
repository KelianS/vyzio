import type { VendorAssistance } from '../../domain/entities/VendorAssistance'
import type { CameraRepository, VendorAssistanceRequest } from '../../domain/ports/CameraRepository'

export class GetVendorAssistance {
  constructor(private readonly repository: CameraRepository) {}

  async execute(input: VendorAssistanceRequest): Promise<VendorAssistance | null> {
    return this.repository.getVendorAssistance(input)
  }
}