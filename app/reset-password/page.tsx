import { redirect } from "next/navigation";
import ResetPasswordForm from "./ResetPasswordForm";

type PageProps = {
  // Next 15: searchParams es una Promesa
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page(props: PageProps) {
  const sp = await props.searchParams;
  const type = Array.isArray(sp.type) ? sp.type[0] : sp.type;

  // SÓLO redirige si el tipo NO es recovery
  if (type !== "recovery") {
    redirect("/login");
  }

  return <ResetPasswordForm />;
}
