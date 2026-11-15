import { HelpCircle } from 'lucide-react'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

/** Second level of help (ADR-17): behind an explicit trigger, never hover-only, which touch cannot reach. */
export function HelpTrigger({ question, help }: { question: string; help: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          aria-label={question}
        >
          <HelpCircle className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" className="max-w-80 text-body">
        {help}
      </PopoverContent>
    </Popover>
  )
}
