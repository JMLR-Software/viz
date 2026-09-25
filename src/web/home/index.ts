import { withRec } from "../shell/lib/rec.js";
import { mountShell } from "../shell/mount.js";
import { SHOWCASES } from "../shell/registry.js";

const { rec } = mountShell(null);

const tiles = document.getElementById("tiles");
if (!tiles) throw new Error("missing #tiles");

tiles.replaceChildren(
  ...SHOWCASES.map((s) => {
    const title = document.createElement("h2");
    title.textContent = s.title;
    const hook = document.createElement("p");
    hook.textContent = s.hook;
    const link = document.createElement("a");
    link.href = withRec(`/${s.slug}/`, rec);
    link.append(title, hook);
    const item = document.createElement("li");
    item.append(link);
    return item;
  }),
);
