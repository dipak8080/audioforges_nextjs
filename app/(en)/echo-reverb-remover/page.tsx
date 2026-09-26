import { UseCasePage, metadataForUseCase } from "@/components/studio/UseCasePage";

export const metadata = metadataForUseCase("echo-reverb-remover");

export default function Page() {
  return <UseCasePage slug="echo-reverb-remover" />;
}