import { ToolSection } from "@/components/ui/ToolSection";
import { YouTubeEmbed } from "@/components/media/YouTubeEmbed";
import { TOOL_VIDEOS } from "@/lib/data/videos";
import { SITE_URL } from "@/lib/constants";

export function ToolVideo({ slug }: { slug: string }) {
  const v = TOOL_VIDEOS[slug];
  if (!v) return null;
  return (
    <ToolSection title={v.heading ?? "Watch how it works"} bleed>
      <YouTubeEmbed
        videoId={v.videoId}
        title={v.title}
        description={v.description}
        uploadDate={v.uploadDate}
        pageUrl={`/${slug}`}
        siteUrl={SITE_URL}
      />
    </ToolSection>
  );
}