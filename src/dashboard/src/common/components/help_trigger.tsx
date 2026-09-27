import { HelpCircle } from 'lucide-react'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

/** Second level of help (ADR-53): behind an explicit trigger, never hover-only, unreachable by touch. */
export function HelpTrigger({ question, help }: { question: string; help: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={question}
        >
          <HelpCircle aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" className="max-w-80 text-sm">
        {help}
      </PopoverContent>
    </Popover>
  )
}
