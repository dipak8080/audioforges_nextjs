import { UseCasePage, metadataForUseCase } from "@/components/studio/UseCasePage";

export const metadata = metadataForUseCase("bass-remover");

export default function Page() {
  return <UseCasePage slug="bass-remover" />;
}