import Link from "next/link";
import { AppLogo } from "@/components/common/AppLogo";

/** TMS `header/HeaderLogo.vue` — logo in the header bar below `lg` (the sidebar shows it on desktop). */
export function HeaderLogo() {
  return (
    <Link href="/" className="flex justify-center lg:hidden" aria-label="Examora home">
      <AppLogo />
    </Link>
  );
}
