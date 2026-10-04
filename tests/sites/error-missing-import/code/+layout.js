import { html } from "@amitkaps/sitez";
import Card from "./card.js";

export default ({ children }) => html`<main>${children}</main>${Card()}`;
