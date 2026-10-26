import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach the merger the kit's glass shadows, so `shadow-none` on a call site
// still overrides the `shadow-glass` baked into a component's variants.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ['hairline', 'glass-sm', 'glass', 'glass-lg', 'focus', 'invalid'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
