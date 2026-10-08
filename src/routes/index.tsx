import { createFileRoute } from "@tanstack/react-router";
import { Companion } from "@/components/companion";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [{ rel: "preload", as: "image", href: "/faces/jonas/rest.jpg?v=board" }],
  }),
  component: Home,
});

function Home() {
  return <Companion />;
}
