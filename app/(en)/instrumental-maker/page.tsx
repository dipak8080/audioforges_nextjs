import { UseCasePage, metadataForUseCase } from "@/components/studio/UseCasePage";

export const metadata = metadataForUseCase("instrumental-maker");

export default function Page() {
  return <UseCasePage slug="instrumental-maker" />;
}