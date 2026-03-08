import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ebbinglish",
    short_name: "Ebbinglish",
    description: "English vocabulary learning with spaced repetition",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    icons: [{ src: "/icon128.png", sizes: "128x128", type: "image/png" }],
  };
}
