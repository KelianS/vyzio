// Up to the last `@` of the address, so a password holding `@` or `/` goes whole.
const URL_USERINFO = /([a-z][a-z0-9+.-]*:\/\/)\S*@/gi
const SECRET_FIELD =
  /("?(?:password|passwd|pwd|token|secret|api[_-]?key)"?\s*[:=]\s*"?)[^"&\s,}]+/gi

/** A diagnostic is photographed and sent around: whatever produced it, it leaves without a secret. */
export function scrubSecrets(text: string): string {
  return text.replace(URL_USERINFO, '$1***@').replace(SECRET_FIELD, '$1***')
}
