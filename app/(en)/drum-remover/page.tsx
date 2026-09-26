import { UseCasePage, metadataForUseCase } from "@/components/studio/UseCasePage";

export const metadata = metadataForUseCase("drum-remover");

export default function Page() {
  return <UseCasePage slug="drum-remover" />;
}