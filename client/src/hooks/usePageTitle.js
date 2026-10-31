import { useEffect } from "react";

// Sets the browser tab title, e.g. usePageTitle("Games") -> "Games | REV".
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | REV` : "REV | The Ruby Enigma Vault";
  }, [title]);
}
