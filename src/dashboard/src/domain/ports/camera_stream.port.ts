import type {
  CameraStreamAddition,
  CameraStreamLineup,
  StreamRole,
} from '../entities/camera_stream.entity'

/** The stream lines of a camera (ADR-65); every answer carries the whole lineup, since roles move across streams. */
export interface CameraStreamRepository {
  getStreams(cameraId: string): Promise<CameraStreamLineup>
  addStream(cameraId: string, addition: CameraStreamAddition): Promise<CameraStreamLineup>
  setStreamRole(cameraId: string, streamId: string, role: StreamRole): Promise<CameraStreamLineup>
  setStreamEnabled(
    cameraId: string,
    streamId: string,
    enabled: boolean,
  ): Promise<CameraStreamLineup>
  removeStream(cameraId: string, streamId: string): Promise<CameraStreamLineup>
  checkStream(cameraId: string, streamId: string): Promise<CameraStreamLineup>
}
