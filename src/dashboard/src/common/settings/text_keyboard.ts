import type { InputHTMLAttributes } from 'react'

/** What a free text field holds, which sets the phone's keyboard and its corrections. */
export type TextKeyboard = 'prose' | 'identifier' | 'address'

type Keyboard = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'autoCapitalize' | 'autoCorrect' | 'spellCheck' | 'inputMode' | 'autoComplete'
>

// A camera compares it character for character: a capital or a correction the user missed locks it out.
const VERBATIM: Keyboard = { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false }

export const TEXT_KEYBOARD: Record<TextKeyboard, Keyboard> = {
  prose: {},
  identifier: VERBATIM,
  address: { ...VERBATIM, inputMode: 'url' },
}

/** A secret is typed verbatim and never offered the password the browser saved for the hub. */
export const SECRET_KEYBOARD: Keyboard = { ...VERBATIM, autoComplete: 'new-password' }
