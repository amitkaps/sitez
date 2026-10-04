import { html } from "sitez";
import Card from "./card.js";

export default ({ children }) => html`<main>${children}</main>${Card()}`;
