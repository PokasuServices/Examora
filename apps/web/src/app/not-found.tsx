import { ErrorPage } from "@/components/common/ErrorPage";

export default function NotFound() {
  return <ErrorPage code="404" message="We can’t seem to find the page you are looking for!" />;
}
