import { BrandLoader } from "@/components/brand-loader";

// Shown while an authenticated app route (and its data) streams in — e.g.
// right after login, or on a hard refresh of /day, /reports, /categories.
export default function AppLoading() {
  return <BrandLoader />;
}
