import { h } from "preact";

/** Receives the Footer view model and renders only the version, to show that a slot can be replaced. */
export default function Footer(props) {
  return h("footer", { class: "site-footer example-footer" }, `example theme, version ${props.version}`);
}
