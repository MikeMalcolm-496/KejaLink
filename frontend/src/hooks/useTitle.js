/** Sets the browser tab title for the current page. */
import { useEffect } from 'react';

export default function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · KejaLink` : 'KejaLink';
  }, [title]);
}
