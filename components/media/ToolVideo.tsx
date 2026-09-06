import { ToolSection } from "@/components/ui/ToolSection";
import { YouTubeEmbed } from "@/components/media/YouTubeEmbed";
import { TOOL_VIDEOS } from "@/lib/data/videos";
import { SITE_URL } from "@/lib/constants";

type Props = { slug: string; bare?: boolean };

export function ToolVideo({ slug, bare = false }: Props) {
  const v = TOOL_VIDEOS[slug];
  if (!v) return null;
  const embed = (
    <YouTubeEmbed
      videoId={v.videoId}
      title={v.title}
      description={v.description}
      uploadDate={v.uploadDate}
      pageUrl={v.pageUrl ?? `/${slug}`}
      siteUrl={SITE_URL}
    />
  );
  if (bare) return embed;
  return (
    <ToolSection title={v.heading ?? "Watch how it works"} bleed>
      {embed}
    </ToolSection>
  );
}