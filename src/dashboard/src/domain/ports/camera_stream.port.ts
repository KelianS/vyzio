import type { StreamProtocol } from '../entities/camera_capability_binding.entity'
import type {
  AvailableStream,
  CameraStreamAddition,
  CameraStreamLineup,
  StreamRole,
} from '../entities/camera_stream.entity'

/** The stream lines of a camera (ADR-65); every change answers with the whole lineup, since roles move across streams. */
export interface CameraStreamRepository {
  getStreams(cameraId: string): Promise<CameraStreamLineup>
  /** What the camera serves over a protocol, asked once that protocol answers. */
  getAvailableStreams(cameraId: string, protocol: StreamProtocol): Promise<AvailableStream[]>
  addStream(cameraId: string, addition: CameraStreamAddition): Promise<CameraStreamLineup>
  setStreamRole(cameraId: string, streamId: string, role: StreamRole): Promise<CameraStreamLineup>
  removeStream(cameraId: string, streamId: string): Promise<CameraStreamLineup>
  checkStream(cameraId: string, streamId: string): Promise<CameraStreamLineup>
}
