import { UseCasePage, metadataForUseCase } from "@/components/studio/UseCasePage";

export const metadata = metadataForUseCase("acapella-extractor");

export default function Page() {
  return <UseCasePage slug="acapella-extractor" />;
}