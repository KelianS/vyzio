/** Tags each call so only the latest may answer: an earlier one landing late would overwrite it. */
export function latestOnly(): () => () => boolean {
  let latest = 0
  return () => {
    const mine = ++latest
    return () => mine === latest
  }
}
