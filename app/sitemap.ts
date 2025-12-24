import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://YOUR_DOMAIN.vercel.app",
      lastModified: new Date(),
    },
    {
      url: "https://YOUR_DOMAIN.vercel.app/play",
      lastModified: new Date(),
    },
  ];
}
