import { Component, type ReactNode } from 'react'

interface Props<T> {
  /** What changes when the screen does: a commit carrying a new one is announced. */
  readonly trigger: unknown
  /** Read from the screen still on the page, just before React replaces it. */
  readonly capture: () => T | null
  /** Handed what `capture` read, once the new screen is on the page and before it is painted. */
  readonly play: (snapshot: T) => void
  readonly children: ReactNode
}

/** Lets the outgoing screen be copied before React replaces it: only a class sees the page before a commit. */
export class SnapshotBeforeCommit<T> extends Component<Props<T>> {
  getSnapshotBeforeUpdate(previous: Props<T>): T | null {
    return previous.trigger === this.props.trigger ? null : this.props.capture()
  }

  componentDidUpdate(_previous: Props<T>, _state: unknown, snapshot: T | null) {
    if (snapshot !== null) this.props.play(snapshot)
  }

  render() {
    return this.props.children
  }
}
